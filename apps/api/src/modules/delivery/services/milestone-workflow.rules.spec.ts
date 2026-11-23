import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  EContractStatus,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EStatus,
} from '@contractflow/contracts-schema';
import { describe, expect, it } from 'vitest';
import {
  assertContractAllows,
  assertMilestoneEditable,
  datesOutsideStage,
  dayInTimeZone,
  requireDateOverride,
  assertStageTransition,
  assertSubmittable,
  classifySubmission,
  evaluateDecision,
  stageTransitionNeedsReason,
  type DecisionContext,
} from './milestone-workflow.rules';

const { APPROVED, PARTIALLY_APPROVED, REJECTED } = EMilestoneDecisionType;

/** "Install 100 solar streetlights", nothing accepted yet. */
const streetlights: DecisionContext = {
  submissionType: EMilestoneSubmissionType.INITIAL,
  approvedBps: 0,
  approvedQuantity: 0,
  targetQuantity: 100,
  addressedItems: [],
};

describe('stage transitions', () => {
  it.each([
    [EStatus.PLANNED, EStatus.IN_PROGRESS],
    [EStatus.IN_PROGRESS, EStatus.ON_HOLD],
    [EStatus.ON_HOLD, EStatus.IN_PROGRESS],
    [EStatus.IN_PROGRESS, EStatus.COMPLETED],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertStageTransition(from, to)).not.toThrow();
  });

  it.each([
    [EStatus.PLANNED, EStatus.COMPLETED],
    [EStatus.PLANNED, EStatus.ON_HOLD],
    [EStatus.ON_HOLD, EStatus.COMPLETED],
    [EStatus.COMPLETED, EStatus.IN_PROGRESS],
    [EStatus.IN_PROGRESS, EStatus.IN_PROGRESS],
  ])('refuses %s → %s', (from, to) => {
    expect(() => assertStageTransition(from, to)).toThrow(ConflictException);
  });

  it('asks for a reason to hold and to resume, not to start or complete', () => {
    expect(
      stageTransitionNeedsReason(EStatus.IN_PROGRESS, EStatus.ON_HOLD),
    ).toBe(true);
    expect(
      stageTransitionNeedsReason(EStatus.ON_HOLD, EStatus.IN_PROGRESS),
    ).toBe(true);
    expect(
      stageTransitionNeedsReason(EStatus.PLANNED, EStatus.IN_PROGRESS),
    ).toBe(false);
    expect(
      stageTransitionNeedsReason(EStatus.IN_PROGRESS, EStatus.COMPLETED),
    ).toBe(false);
  });
});

describe('milestone submissions and edits', () => {
  it.each([
    EMilestoneStatus.PLANNED,
    EMilestoneStatus.IN_PROGRESS,
    EMilestoneStatus.REJECTED,
    EMilestoneStatus.PARTIALLY_APPROVED,
  ])('accepts a submission while %s', (status) => {
    expect(() => assertSubmittable(status)).not.toThrow();
  });

  it.each([
    [EMilestoneStatus.PENDING_APPROVAL, /waiting for a decision/],
    [EMilestoneStatus.APPROVED, /already approved/],
    [EMilestoneStatus.CANCELLED, /can.t be submitted/],
    [EMilestoneStatus.ON_HOLD, /can.t be submitted/],
  ])('refuses a submission while %s', (status, message) => {
    expect(() => assertSubmittable(status)).toThrow(message);
  });

  it('fixes the scope at the first submission, and everything at approval', () => {
    expect(() =>
      assertMilestoneEditable(EMilestoneStatus.PLANNED, false, true),
    ).not.toThrow();
    expect(() =>
      assertMilestoneEditable(EMilestoneStatus.REJECTED, true, false),
    ).not.toThrow();
    expect(() =>
      assertMilestoneEditable(EMilestoneStatus.REJECTED, true, true),
    ).toThrow(/only the milestone’s dates can change/);
    expect(() =>
      assertMilestoneEditable(EMilestoneStatus.APPROVED, true, false),
    ).toThrow(/approved milestone/);
  });
});

describe('classifySubmission', () => {
  it('makes the first submission cover the whole milestone', () => {
    expect(
      classifySubmission({
        latestDecision: null,
        openItems: [],
        requestedItemIds: [],
      }),
    ).toEqual({
      submissionType: EMilestoneSubmissionType.INITIAL,
      previousDecisionId: null,
      addressedItemIds: [],
    });
  });

  it('links a resubmission after a rejection to that rejection', () => {
    expect(
      classifySubmission({
        latestDecision: { id: 'rejection-1', decision: REJECTED },
        openItems: [],
        requestedItemIds: [],
      }),
    ).toEqual({
      submissionType: EMilestoneSubmissionType.RESUBMISSION,
      previousDecisionId: 'rejection-1',
      addressedItemIds: [],
    });
  });

  it('after a partial approval, covers exactly the open items and links the decision', () => {
    expect(
      classifySubmission({
        latestDecision: { id: 'partial-1', decision: PARTIALLY_APPROVED },
        openItems: [
          { id: 'item-1', quantity: 20 },
          { id: 'item-2', quantity: 10 },
        ],
        requestedItemIds: ['item-2', 'item-1'],
      }),
    ).toEqual({
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      previousDecisionId: 'partial-1',
      addressedItemIds: ['item-2', 'item-1'],
    });
  });

  it('refuses to resubmit accepted work, to skip open items, or to name an item twice', () => {
    const open = [
      { id: 'item-1', quantity: 20 },
      { id: 'item-2', quantity: 10 },
    ];
    const latestDecision = { id: 'partial-1', decision: PARTIALLY_APPROVED };
    expect(() =>
      classifySubmission({
        latestDecision,
        openItems: open,
        requestedItemIds: ['item-1', 'accepted-item'],
      }),
    ).toThrow(/accepted work is not resubmitted/);
    expect(() =>
      classifySubmission({
        latestDecision,
        openItems: open,
        requestedItemIds: ['item-1'],
      }),
    ).toThrow(/every open outstanding item/);
    expect(() =>
      classifySubmission({
        latestDecision,
        openItems: open,
        requestedItemIds: [],
      }),
    ).toThrow(/every open outstanding item/);
    expect(() =>
      classifySubmission({
        latestDecision,
        openItems: open,
        requestedItemIds: ['item-1', 'item-1', 'item-2'],
      }),
    ).toThrow(/once/);
  });

  it('refuses outstanding items when none are open', () => {
    expect(() =>
      classifySubmission({
        latestDecision: { id: 'rejection-1', decision: REJECTED },
        openItems: [],
        requestedItemIds: ['item-1'],
      }),
    ).toThrow(/no open outstanding items/);
  });
});

describe('evaluateDecision', () => {
  it('records the streetlight partial approval: 70% accepted, 20 to correct, 10 to replace', () => {
    const outcome = evaluateDecision(
      {
        decision: PARTIALLY_APPROVED,
        reason:
          '30 units did not meet the agreed installation and quality requirements.',
        approvedBps: 7000,
        approvedWork: '70 verified installations',
        approvedQuantity: 70,
        outstandingItems: [
          { description: 'Correct the installation of 20 units', quantity: 20 },
          { description: 'Replace 10 units', quantity: 10 },
        ],
      },
      streetlights,
    );

    expect(outcome).toEqual({
      decision: PARTIALLY_APPROVED,
      reason:
        '30 units did not meet the agreed installation and quality requirements.',
      approvedBps: 7000,
      cumulativeApprovedBps: 7000,
      approvedWork: '70 verified installations',
      approvedQuantity: 70,
      cumulativeApprovedQuantity: 70,
      newItems: [
        { description: 'Correct the installation of 20 units', quantity: 20 },
        { description: 'Replace 10 units', quantity: 10 },
      ],
      acceptedItemIds: [],
      milestoneStatus: EMilestoneStatus.PARTIALLY_APPROVED,
    });
  });

  it('accepts some outstanding items of a resubmission and leaves the rest open', () => {
    const outcome = evaluateDecision(
      {
        decision: PARTIALLY_APPROVED,
        reason: 'The 10 replacements are not delivered yet.',
        approvedBps: 2000,
        approvedWork: '20 installations corrected',
        acceptedItemIds: ['correct-20'],
      },
      {
        submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
        approvedBps: 7000,
        approvedQuantity: 70,
        targetQuantity: 100,
        addressedItems: [
          { id: 'correct-20', quantity: 20 },
          { id: 'replace-10', quantity: 10 },
        ],
      },
    );
    expect(outcome).toMatchObject({
      approvedBps: 2000,
      cumulativeApprovedBps: 9000,
      approvedQuantity: 20,
      cumulativeApprovedQuantity: 90,
      acceptedItemIds: ['correct-20'],
      newItems: [],
      milestoneStatus: EMilestoneStatus.PARTIALLY_APPROVED,
    });
  });

  it('completes the milestone on approval, accepting every item the submission covers', () => {
    const outcome = evaluateDecision(
      { decision: APPROVED },
      {
        submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
        approvedBps: 9000,
        approvedQuantity: 90,
        targetQuantity: 100,
        addressedItems: [{ id: 'replace-10', quantity: 10 }],
      },
    );
    expect(outcome).toMatchObject({
      approvedBps: 1000,
      cumulativeApprovedBps: 10000,
      approvedQuantity: 10,
      cumulativeApprovedQuantity: 100,
      acceptedItemIds: ['replace-10'],
      milestoneStatus: EMilestoneStatus.APPROVED,
    });
  });

  it('accepts nothing on rejection and keeps what was accepted before', () => {
    const outcome = evaluateDecision(
      { decision: REJECTED, reason: 'Photos don’t show the poles.' },
      { ...streetlights, approvedBps: 7000, approvedQuantity: 70 },
    );
    expect(outcome).toMatchObject({
      approvedBps: 0,
      cumulativeApprovedBps: 7000,
      cumulativeApprovedQuantity: 70,
      acceptedItemIds: [],
      milestoneStatus: EMilestoneStatus.REJECTED,
    });
  });

  it.each([
    ['without a reason', { decision: REJECTED }, /needs a reason/],
    [
      'that accepts work',
      { decision: REJECTED, reason: 'No', approvedBps: 1000 },
      /accepts nothing/,
    ],
  ])('refuses a rejection %s', (_label, request, message) => {
    expect(() => evaluateDecision(request, streetlights)).toThrow(message);
  });

  const partial = {
    decision: PARTIALLY_APPROVED,
    reason: 'Not all units pass.',
    approvedBps: 7000,
    approvedWork: '70 units',
    approvedQuantity: 70,
    outstandingItems: [{ description: '30 units', quantity: 30 }],
  };

  it.each([
    ['without a reason', { ...partial, reason: ' ' }, /needs a reason/],
    [
      'without the approved work',
      { ...partial, approvedWork: null },
      /describe the work/,
    ],
    ['at 0%', { ...partial, approvedBps: 0 }, /more than 0%/],
    ['at 100%', { ...partial, approvedBps: 10000 }, /less than the 100%/],
    ['above what remains', { ...partial, approvedBps: 12000 }, /less than/],
    [
      'without outstanding work',
      { ...partial, outstandingItems: [] },
      /list the outstanding work/,
    ],
    [
      'whose quantities don’t add up to the target',
      {
        ...partial,
        outstandingItems: [{ description: '20 units', quantity: 20 }],
      },
      /must add up to the 100/,
    ],
    [
      'whose percentage contradicts the accepted quantity',
      { ...partial, approvedBps: 6000 },
      /70 of 100 accepted, the milestone is 70% accepted, not 60%/,
    ],
    [
      'with an item without a quantity',
      { ...partial, outstandingItems: [{ description: '30 units' }] },
      /needs a quantity/,
    ],
    [
      'without the accepted quantity',
      { ...partial, approvedQuantity: null },
      /quantity accepted/,
    ],
    [
      'that accepts items of a whole-milestone submission',
      { ...partial, acceptedItemIds: ['item-1'] },
      /covers the whole milestone/,
    ],
  ])('refuses a partial approval %s', (_label, request, message) => {
    expect(() => evaluateDecision(request, streetlights)).toThrow(message);
  });

  it('refuses to accept all, none or uncovered items in a partial approval of outstanding work', () => {
    const context: DecisionContext = {
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      approvedBps: 7000,
      approvedQuantity: 70,
      targetQuantity: 100,
      addressedItems: [
        { id: 'a', quantity: 20 },
        { id: 'b', quantity: 10 },
      ],
    };
    const base = {
      decision: PARTIALLY_APPROVED,
      reason: 'Some remain.',
      approvedBps: 2000,
      approvedWork: 'Corrections',
    };
    expect(() =>
      evaluateDecision({ ...base, acceptedItemIds: ['a', 'b'] }, context),
    ).toThrow(/not all/);
    expect(() =>
      evaluateDecision({ ...base, acceptedItemIds: [] }, context),
    ).toThrow(/at least one/);
    expect(() =>
      evaluateDecision({ ...base, acceptedItemIds: ['other'] }, context),
    ).toThrow(/Only items this submission covers/);
    expect(() =>
      evaluateDecision(
        {
          ...base,
          acceptedItemIds: ['a'],
          outstandingItems: [{ description: 'New', quantity: 1 }],
        },
        context,
      ),
    ).toThrow(/raises no new items/);
    expect(() =>
      evaluateDecision(
        { ...base, acceptedItemIds: ['a'], approvedQuantity: 15 },
        context,
      ),
    ).toThrow(/add up to 20, not 15/);
  });

  it('works without a target quantity: the percentage alone, with optional item quantities', () => {
    const outcome = evaluateDecision(
      {
        decision: PARTIALLY_APPROVED,
        reason: 'Snagging remains.',
        approvedBps: 8500,
        approvedWork: 'Structure complete',
        outstandingItems: [{ description: 'Snag list items 4 to 9' }],
      },
      { ...streetlights, targetQuantity: null, approvedQuantity: null },
    );
    expect(outcome).toMatchObject({
      cumulativeApprovedBps: 8500,
      approvedQuantity: null,
      cumulativeApprovedQuantity: null,
    });
    expect(() =>
      evaluateDecision(
        { ...partial, outstandingItems: [{ description: 'x' }] },
        { ...streetlights, targetQuantity: null, approvedQuantity: null },
      ),
    ).toThrow(/no target quantity/);
  });

  it('refuses outstanding items on an approval', () => {
    expect(() =>
      evaluateDecision(
        {
          decision: APPROVED,
          outstandingItems: [{ description: 'x', quantity: 1 }],
        },
        streetlights,
      ),
    ).toThrow(BadRequestException);
  });
});

describe('contract status (approved rule 6)', () => {
  it.each([
    [EContractStatus.DRAFT, 'planning', true],
    [EContractStatus.DRAFT, 'operation', false],
    [EContractStatus.ACTIVE, 'planning', true],
    [EContractStatus.ACTIVE, 'operation', true],
    [EContractStatus.SUSPENDED, 'planning', false],
    [EContractStatus.SUSPENDED, 'operation', false],
    [EContractStatus.COMPLETED, 'planning', false],
    [EContractStatus.COMPLETED, 'operation', false],
  ] as const)('a %s contract allows %s: %s', (status, action, allowed) => {
    const check = () => assertContractAllows(status, action);
    if (allowed) expect(check).not.toThrow();
    else expect(check).toThrow(ConflictException);
  });
});

describe('dayInTimeZone (approved rule 7)', () => {
  const lateUtc = new Date('2026-12-31T23:30:00Z');

  it('gives the contract’s own calendar day', () => {
    expect(dayInTimeZone(lateUtc, 'Africa/Lagos')).toBe('2027-01-01');
    expect(dayInTimeZone(lateUtc, 'America/New_York')).toBe('2026-12-31');
    expect(
      dayInTimeZone(new Date('2026-06-01T11:00:00Z'), 'Pacific/Auckland'),
    ).toBe('2026-06-01');
    expect(
      dayInTimeZone(new Date('2026-06-01T13:00:00Z'), 'Pacific/Auckland'),
    ).toBe('2026-06-02');
  });

  it('falls back to UTC for a missing or unknown time zone', () => {
    expect(dayInTimeZone(lateUtc, null)).toBe('2026-12-31');
    expect(dayInTimeZone(lateUtc, 'Mars/Olympus')).toBe('2026-12-31');
  });
});

describe('dates within the stage (approved rule 8)', () => {
  const stage = {
    plannedStartDate: '2027-01-01',
    plannedEndDate: '2027-06-30',
  };

  it('accepts dates on the stage’s boundaries', () => {
    expect(
      datesOutsideStage(stage, {
        plannedStartDate: '2027-01-01',
        dueDate: '2027-06-30',
      }),
    ).toEqual([]);
    expect(
      datesOutsideStage(stage, {
        plannedStartDate: null,
        dueDate: '2027-03-01',
      }),
    ).toEqual([]);
  });

  it('names each date outside the stage', () => {
    expect(
      datesOutsideStage(stage, {
        plannedStartDate: '2026-12-31',
        dueDate: '2027-07-01',
      }),
    ).toEqual(['its planned start (2026-12-31)', 'its due date (2027-07-01)']);
  });

  it('refuses without a reason, and returns the reason when one is needed', () => {
    expect(requireDateOverride([], undefined, 'The milestone’s')).toBeNull();
    expect(requireDateOverride([], 'unused', 'The milestone’s')).toBeNull();
    expect(() =>
      requireDateOverride(
        ['its due date (2027-07-01)'],
        '  ',
        'The milestone’s',
      ),
    ).toThrow(/dateOverrideReason/);
    expect(
      requireDateOverride(
        ['its due date (2027-07-01)'],
        ' Late handover. ',
        'The milestone’s',
      ),
    ).toBe('Late handover.');
  });
});
