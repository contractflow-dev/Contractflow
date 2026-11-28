import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Contract } from '../../contract/entities/contract.entity';
import {
  EContractStatus,
  ELifecycleStageCode,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EStatus,
  type DecideMilestoneSubmissionRequest,
  type MilestoneOutstandingItemInput,
} from '@contractflow/contracts-schema';

/**
 * The Stages and Milestones workflow rules, without persistence: which
 * transitions are allowed, what a submission covers, and what a decision
 * accepts. `MilestoneWorkflowService` applies them inside its transactions.
 */

export const FULL_BPS = 10_000;

// --- Contract status (approved 22 November 2026, rule 6) -------------------

/**
 * `planning`: creating and changing stages and milestones. `operation`:
 * recording what happens: starting, holding, resuming or completing a stage,
 * and starting, submitting or deciding on a milestone.
 */
export type ContractAction = 'planning' | 'operation';

const ALLOWED_ACTIONS: Record<EContractStatus, readonly ContractAction[]> = {
  [EContractStatus.DRAFT]: ['planning'],
  [EContractStatus.ACTIVE]: ['planning', 'operation'],
  [EContractStatus.SUSPENDED]: [],
  // Only the post-contract obligations stage: see assertStageWorkAllowed.
  [EContractStatus.DEFECTS_LIABILITY]: ['planning', 'operation'],
  [EContractStatus.COMPLETED]: [],
};

/**
 * During the defects liability period only the warranty, defects liability
 * and post-contract obligations stage is worked on (decision D-12); every
 * other stage, and its milestones, can be read but not changed.
 */
export function assertStageWorkAllowed(
  contract: Pick<Contract, 'status'>,
  stage: { stageCode: ELifecycleStageCode | null },
): void {
  if (
    contract.status === EContractStatus.DEFECTS_LIABILITY &&
    stage.stageCode !== ELifecycleStageCode.POST_CONTRACT_OBLIGATIONS
  ) {
    throw new ConflictException(
      'During the defects liability period only the post-contract obligations stage can change.',
    );
  }
}

/**
 * A contract created from a lifecycle has its stage plan fixed once it is
 * active (decision D-4): no new stages and no weight changes. Whether a
 * stage applies can still change. Older contracts keep their rules.
 */
export function assertPlanEditable(
  contract: Pick<Contract, 'status' | 'lifecycleTemplateVersionId'>,
): void {
  if (contract.status === EContractStatus.DEFECTS_LIABILITY) {
    throw new ConflictException(
      'During the defects liability period the stage plan can’t change.',
    );
  }
  if (
    contract.lifecycleTemplateVersionId &&
    contract.status !== EContractStatus.DRAFT
  ) {
    throw new ConflictException(
      'Once the contract is active its stage plan is fixed: stages can’t be added and weights can’t change. Mark a stage as not applying instead.',
    );
  }
}

export function assertContractAllows(
  status: EContractStatus,
  action: ContractAction,
): void {
  if (ALLOWED_ACTIONS[status]?.includes(action)) return;
  if (status === EContractStatus.DRAFT) {
    throw new ConflictException(
      'This contract is still a draft: stages and milestones can be planned, but work can only be started, submitted or decided once it is active.',
    );
  }
  throw new ConflictException(
    `This contract is ${label(status)}: its stages and milestones can be read but not changed.`,
  );
}

// --- Days (approved 22 November 2026, rule 7) ------------------------------

/**
 * The calendar day of `now` in the contract's time zone, as `YYYY-MM-DD`. A
 * time zone that isn't a valid IANA name falls back to UTC.
 */
export function dayInTimeZone(
  now: Date,
  timeZone: string | null | undefined,
): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
      const part = (type: string) => parts.find((p) => p.type === type)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      // An unknown time zone: use UTC below.
    }
  }
  return now.toISOString().slice(0, 10);
}

// --- Dates within the stage (approved 22 November 2026, rule 8) ------------

/**
 * Which of a milestone's planned dates fall outside its stage's planned
 * dates. The revised due date isn't checked: it records a slip.
 */
export function datesOutsideStage(
  stage: { plannedStartDate: string; plannedEndDate: string },
  milestone: { plannedStartDate: string | null; dueDate: string },
): string[] {
  const problems: string[] = [];
  const within = (day: string) =>
    day >= stage.plannedStartDate && day <= stage.plannedEndDate;
  if (milestone.plannedStartDate && !within(milestone.plannedStartDate)) {
    problems.push(`its planned start (${milestone.plannedStartDate})`);
  }
  if (!within(milestone.dueDate)) {
    problems.push(`its due date (${milestone.dueDate})`);
  }
  return problems;
}

/**
 * Refuses dates outside the stage unless the Client Project Manager gave an
 * override reason; returns the reason to record when one was needed.
 */
export function requireDateOverride(
  problems: readonly string[],
  overrideReason: string | null | undefined,
  subject: string,
): string | null {
  if (!problems.length) return null;
  const reason = overrideReason?.trim();
  if (!reason) {
    throw new BadRequestException(
      `${subject} ${problems.join(' and ')} fall outside the stage's planned dates. Give a dateOverrideReason to plan it this way anyway.`,
    );
  }
  return reason;
}

// --- Stages -----------------------------------------------------------------

/** Stage statuses the Client Project Manager can move a stage to, by current status. */
const STAGE_TRANSITIONS: Partial<Record<EStatus, readonly EStatus[]>> = {
  [EStatus.PLANNED]: [EStatus.IN_PROGRESS, EStatus.CANCELLED],
  [EStatus.IN_PROGRESS]: [
    EStatus.ON_HOLD,
    EStatus.COMPLETED,
    EStatus.CANCELLED,
  ],
  [EStatus.ON_HOLD]: [EStatus.IN_PROGRESS, EStatus.CANCELLED],
};

/** Stages in these statuses accept no planning changes or new milestones. */
export const CLOSED_STAGE_STATUSES: readonly EStatus[] = [
  EStatus.COMPLETED,
  EStatus.CANCELLED,
];

export function assertStageTransition(from: EStatus, to: EStatus): void {
  if (!STAGE_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictException(
      `A stage can't move from ${label(from)} to ${label(to)}.`,
    );
  }
}

/** Holding and resuming a stage need an explanation. */
export function stageTransitionNeedsReason(
  from: EStatus,
  to: EStatus,
): boolean {
  return (
    to === EStatus.ON_HOLD ||
    to === EStatus.CANCELLED ||
    (from === EStatus.ON_HOLD && to === EStatus.IN_PROGRESS)
  );
}

// --- Milestones -------------------------------------------------------------

/** Statuses from which the contractor may submit. */
const SUBMITTABLE: readonly EMilestoneStatus[] = [
  EMilestoneStatus.PLANNED,
  EMilestoneStatus.IN_PROGRESS,
  EMilestoneStatus.REJECTED,
  EMilestoneStatus.PARTIALLY_APPROVED,
];

export function assertSubmittable(status: EMilestoneStatus): void {
  if (status === EMilestoneStatus.PENDING_APPROVAL) {
    throw new ConflictException(
      'This milestone already has a submission waiting for a decision.',
    );
  }
  if (status === EMilestoneStatus.APPROVED) {
    throw new ConflictException('This milestone is already approved.');
  }
  if (!SUBMITTABLE.includes(status)) {
    throw new ConflictException(
      `A milestone that is ${label(status)} can't be submitted.`,
    );
  }
}

/** Scope fields lock at the first submission; schedule fields at approval. */
export function assertMilestoneEditable(
  status: EMilestoneStatus,
  hasSubmissions: boolean,
  changesScope: boolean,
): void {
  if (status === EMilestoneStatus.APPROVED) {
    throw new ConflictException('An approved milestone can no longer change.');
  }
  if (changesScope && hasSubmissions) {
    throw new ConflictException(
      'Once work has been submitted, only the milestone’s dates can change: its scope, target, weight and payment terms are fixed.',
    );
  }
}

export interface OpenItem {
  id: string;
  quantity: number | null;
}

/**
 * What the next submission covers. After a partial approval, while items are
 * open, it covers exactly the open items, all of them, and nothing already
 * accepted. Otherwise it covers the whole milestone and names no items.
 */
export function classifySubmission(input: {
  latestDecision: { id: string; decision: EMilestoneDecisionType } | null;
  openItems: readonly OpenItem[];
  requestedItemIds: readonly string[];
}): {
  submissionType: EMilestoneSubmissionType;
  previousDecisionId: string | null;
  addressedItemIds: string[];
} {
  const requested = [...new Set(input.requestedItemIds)];
  if (requested.length !== input.requestedItemIds.length) {
    throw new BadRequestException('Each outstanding item can be named once.');
  }
  if (input.openItems.length > 0) {
    const open = new Set(input.openItems.map(({ id }) => id));
    const unknown = requested.filter((id) => !open.has(id));
    if (unknown.length) {
      throw new BadRequestException(
        'Only open outstanding items of this milestone can be submitted; accepted work is not resubmitted.',
      );
    }
    if (requested.length !== open.size) {
      throw new BadRequestException(
        'The submission must cover every open outstanding item of this milestone, and only those.',
      );
    }
    return {
      submissionType: EMilestoneSubmissionType.OUTSTANDING_WORK,
      previousDecisionId: input.latestDecision?.id ?? null,
      addressedItemIds: requested,
    };
  }
  if (requested.length) {
    throw new BadRequestException(
      'This milestone has no open outstanding items; submit the whole milestone.',
    );
  }
  return input.latestDecision
    ? {
        submissionType: EMilestoneSubmissionType.RESUBMISSION,
        previousDecisionId: input.latestDecision.id,
        addressedItemIds: [],
      }
    : {
        submissionType: EMilestoneSubmissionType.INITIAL,
        previousDecisionId: null,
        addressedItemIds: [],
      };
}

export interface DecisionContext {
  submissionType: EMilestoneSubmissionType;
  /** The milestone's accepted share before this decision. */
  approvedBps: number;
  approvedQuantity: number | null;
  targetQuantity: number | null;
  /** For an outstanding-work submission, the items it covers. */
  addressedItems: readonly OpenItem[];
}

export interface DecisionOutcome {
  decision: EMilestoneDecisionType;
  reason: string | null;
  /** This decision's share of the milestone. */
  approvedBps: number;
  cumulativeApprovedBps: number;
  approvedWork: string | null;
  /** This decision's accepted quantity. */
  approvedQuantity: number | null;
  /** The milestone's accepted quantity after the decision. */
  cumulativeApprovedQuantity: number | null;
  /** Items to raise (partial approval of a whole-milestone submission). */
  newItems: MilestoneOutstandingItemInput[];
  /** Covered items this decision accepts. */
  acceptedItemIds: string[];
  milestoneStatus: EMilestoneStatus;
}

/**
 * Validates a decision against the submission and the milestone and works
 * out its effect. The approved share is a judgement of work accepted, never a
 * payment amount.
 */
export function evaluateDecision(
  request: DecideMilestoneSubmissionRequest,
  context: DecisionContext,
): DecisionOutcome {
  const reason = text(request.reason);
  const approvedWork = text(request.approvedWork);
  const newItems = request.outstandingItems ?? [];
  const acceptedItemIds = [...new Set(request.acceptedItemIds ?? [])];
  if (acceptedItemIds.length !== (request.acceptedItemIds ?? []).length) {
    throw new BadRequestException(
      'Each outstanding item can be accepted once.',
    );
  }
  const remainingBps = FULL_BPS - context.approvedBps;
  const priorQuantity = context.approvedQuantity ?? 0;
  const target = context.targetQuantity;
  const coversItems =
    context.submissionType === EMilestoneSubmissionType.OUTSTANDING_WORK;

  switch (request.decision) {
    case EMilestoneDecisionType.APPROVED: {
      if (newItems.length || acceptedItemIds.length) {
        throw new BadRequestException(
          'An approval accepts everything the submission covers; it names no outstanding items.',
        );
      }
      return {
        decision: request.decision,
        reason,
        approvedBps: remainingBps,
        cumulativeApprovedBps: FULL_BPS,
        approvedWork,
        approvedQuantity: target === null ? null : target - priorQuantity,
        cumulativeApprovedQuantity: target,
        newItems: [],
        acceptedItemIds: context.addressedItems.map(({ id }) => id),
        milestoneStatus: EMilestoneStatus.APPROVED,
      };
    }

    case EMilestoneDecisionType.REJECTED: {
      if (!reason) {
        throw new BadRequestException('A rejection needs a reason.');
      }
      if (
        (request.approvedBps ?? 0) !== 0 ||
        request.approvedQuantity != null ||
        newItems.length ||
        acceptedItemIds.length
      ) {
        throw new BadRequestException(
          'A rejection accepts nothing: leave out approved work, quantities and items.',
        );
      }
      return {
        decision: request.decision,
        reason,
        approvedBps: 0,
        cumulativeApprovedBps: context.approvedBps,
        approvedWork: null,
        approvedQuantity: null,
        cumulativeApprovedQuantity: context.approvedQuantity,
        newItems: [],
        acceptedItemIds: [],
        milestoneStatus: EMilestoneStatus.REJECTED,
      };
    }

    case EMilestoneDecisionType.PARTIALLY_APPROVED: {
      if (!reason) {
        throw new BadRequestException('A partial approval needs a reason.');
      }
      if (!approvedWork) {
        throw new BadRequestException(
          'A partial approval must describe the work it accepts.',
        );
      }
      const approvedBps = request.approvedBps;
      if (
        approvedBps == null ||
        !Number.isInteger(approvedBps) ||
        approvedBps <= 0 ||
        approvedBps >= remainingBps
      ) {
        throw new BadRequestException(
          `A partial approval accepts more than 0% and less than the ${percent(remainingBps)} not yet accepted.`,
        );
      }
      const cumulativeApprovedBps = context.approvedBps + approvedBps;

      let approvedQuantity: number | null = null;
      let acceptedIds: string[] = [];
      let itemsToRaise: MilestoneOutstandingItemInput[] = [];

      if (coversItems) {
        // Some, not all, of the covered items are accepted; the rest stay open.
        if (newItems.length) {
          throw new BadRequestException(
            'Items not accepted stay outstanding; a partial approval of outstanding work raises no new items.',
          );
        }
        const covered = new Map(
          context.addressedItems.map((item) => [item.id, item]),
        );
        if (!acceptedItemIds.length || acceptedItemIds.length >= covered.size) {
          throw new BadRequestException(
            'Name the outstanding items this decision accepts: at least one, and not all (accepting all is an approval).',
          );
        }
        if (acceptedItemIds.some((id) => !covered.has(id))) {
          throw new BadRequestException(
            'Only items this submission covers can be accepted.',
          );
        }
        acceptedIds = acceptedItemIds;
        if (target !== null) {
          approvedQuantity = acceptedIds.reduce(
            (sum, id) => sum + (covered.get(id)?.quantity ?? 0),
            0,
          );
          if (
            request.approvedQuantity != null &&
            request.approvedQuantity !== approvedQuantity
          ) {
            throw new BadRequestException(
              `The accepted items add up to ${approvedQuantity}, not ${request.approvedQuantity}.`,
            );
          }
        } else if (request.approvedQuantity != null) {
          throw new BadRequestException(
            'This milestone has no target quantity.',
          );
        }
      } else {
        // A whole-milestone submission: the rest becomes outstanding items.
        if (acceptedItemIds.length) {
          throw new BadRequestException(
            'This submission covers the whole milestone, not outstanding items.',
          );
        }
        if (!newItems.length) {
          throw new BadRequestException(
            'A partial approval must list the outstanding work.',
          );
        }
        itemsToRaise = newItems.map((item) => validateItem(item, target));
        if (target !== null) {
          approvedQuantity = request.approvedQuantity ?? null;
          if (
            approvedQuantity === null ||
            !Number.isInteger(approvedQuantity) ||
            approvedQuantity <= 0
          ) {
            throw new BadRequestException(
              'Give the quantity accepted: this milestone has a target quantity.',
            );
          }
          const outstanding = itemsToRaise.reduce(
            (sum, item) => sum + (item.quantity ?? 0),
            0,
          );
          const remaining = target - priorQuantity;
          if (approvedQuantity + outstanding !== remaining) {
            throw new BadRequestException(
              `Accepted (${approvedQuantity}) and outstanding (${outstanding}) quantities must add up to the ${remaining} not yet accepted.`,
            );
          }
        } else if (request.approvedQuantity != null) {
          throw new BadRequestException(
            'This milestone has no target quantity.',
          );
        }
      }

      const cumulativeApprovedQuantity =
        target === null ? null : priorQuantity + (approvedQuantity ?? 0);
      // With a measurable target, the share accepted follows the quantity.
      if (target !== null && cumulativeApprovedQuantity !== null) {
        const expected = Math.floor(
          (cumulativeApprovedQuantity * FULL_BPS) / target,
        );
        if (cumulativeApprovedBps !== expected) {
          throw new BadRequestException(
            `With ${cumulativeApprovedQuantity} of ${target} accepted, the milestone is ${percent(expected)} accepted, not ${percent(cumulativeApprovedBps)}.`,
          );
        }
      }

      return {
        decision: request.decision,
        reason,
        approvedBps,
        cumulativeApprovedBps,
        approvedWork,
        approvedQuantity,
        cumulativeApprovedQuantity,
        newItems: itemsToRaise,
        acceptedItemIds: acceptedIds,
        milestoneStatus: EMilestoneStatus.PARTIALLY_APPROVED,
      };
    }

    default:
      throw new BadRequestException('Unknown decision.');
  }
}

function validateItem(
  item: MilestoneOutstandingItemInput,
  target: number | null,
): MilestoneOutstandingItemInput {
  const description = text(item.description);
  if (!description) {
    throw new BadRequestException('Each outstanding item needs a description.');
  }
  if (target !== null) {
    if (
      item.quantity == null ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new BadRequestException(
        'Each outstanding item needs a quantity: this milestone has a target quantity.',
      );
    }
  } else if (
    item.quantity != null &&
    (!Number.isInteger(item.quantity) || item.quantity <= 0)
  ) {
    throw new BadRequestException(
      'An item quantity must be a whole number above 0.',
    );
  }
  return { description, quantity: item.quantity ?? null };
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function percent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function label(status: string): string {
  return status.replace(/_/g, ' ');
}
