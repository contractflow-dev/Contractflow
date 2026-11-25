import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EClientContractRole,
  EContractStatus,
  EContractorContractRole,
  EDocumentCategory,
  EDocumentVisibility,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EPartyType,
  EStatus,
} from '@contractflow/contracts-schema';
import { describe, expect, it, vi } from 'vitest';
import type { ContractAccessService } from '../../contract/services/contract-access.service';
import type {
  IMilestoneWorkflowContext,
  IMilestoneWorkflowReader,
  IMilestoneWorkflowUnitOfWork,
} from '../interface/milestone-workflow-persistence.interface';
import { MilestoneWorkflowService } from './milestone-workflow.service';

/** What `authorize` returns: deliberately not the request's identifiers. */
const SCOPE = { contractId: 'scoped-contract', companyId: 'scoped-company' };
const CALLER = {
  userId: 'user-1',
  companyId: 'header-company',
  contractId: 'header-contract',
};

type Mocked<T> = {
  [K in keyof T]: { [M in keyof T[K]]: ReturnType<typeof vi.fn> };
};

function milestone(overrides: Record<string, unknown> = {}) {
  return {
    id: 'milestone-1',
    contractId: SCOPE.contractId,
    contractStageId: 'stage-1',
    title: 'Install 100 streetlights',
    status: EMilestoneStatus.PENDING_APPROVAL,
    approvedBps: 0,
    approvedQuantity: 0,
    targetQuantity: 100,
    actualStartDate: null,
    dueDate: '2027-06-30',
    weightBps: 1000,
    progressBps: 0,
    createdAt: new Date('2026-11-21T10:00:00Z'),
    updatedAt: new Date('2026-11-21T10:00:00Z'),
    ...overrides,
  };
}

function setup(
  options: {
    partyType?: EPartyType;
    holdsRole?: boolean;
    contract?: object | null;
    contractStatus?: EContractStatus;
  } = {},
) {
  const access = { authorize: vi.fn().mockResolvedValue(SCOPE) };
  const context: Mocked<IMilestoneWorkflowContext> = {
    memberships: {
      findActiveForUpdate: vi
        .fn()
        .mockResolvedValue({ id: 'member-1', companyId: SCOPE.companyId }),
    },
    parties: {
      findOwnForShare: vi.fn().mockResolvedValue({
        id: 'party-1',
        partyType: options.partyType ?? EPartyType.AWARDED,
      }),
    },
    roleAssignments: {
      hasActiveRoleForShare: vi
        .fn()
        .mockResolvedValue(options.holdsRole ?? true),
    },
    contracts: {
      findActiveForLock: vi.fn().mockResolvedValue(
        options.contract === undefined
          ? {
              id: SCOPE.contractId,
              currencyCode: 'NGN',
              status: options.contractStatus ?? EContractStatus.ACTIVE,
              timezone: 'Africa/Lagos',
            }
          : options.contract,
      ),
    },
    stages: {
      findForUpdate: vi.fn().mockResolvedValue({
        id: 'stage-1',
        name: 'Lighting',
        sequence: 1,
        status: EStatus.IN_PROGRESS,
        plannedStartDate: '2027-01-01',
        plannedEndDate: '2027-12-31',
        actualStartDate: '2026-01-01',
      }),
      findForShare: vi.fn().mockResolvedValue({
        id: 'stage-1',
        status: EStatus.IN_PROGRESS,
        plannedStartDate: '2027-01-01',
        plannedEndDate: '2027-12-31',
      }),
      totalWeight: vi.fn().mockResolvedValue(0),
      nextSequence: vi.fn().mockResolvedValue(1),
      append: vi.fn(async (_scope, data) => ({
        id: 'stage-2',
        createdAt: new Date('2026-11-21T10:00:00Z'),
        updatedAt: new Date('2026-11-21T10:00:00Z'),
        ...data,
      })),
      update: vi.fn(async (_scope, id, changes) => ({
        id,
        sequence: 1,
        name: 'Lighting',
        description: null,
        status: EStatus.IN_PROGRESS,
        weightBps: 5000,
        plannedStartDate: '2027-01-01',
        plannedEndDate: '2027-12-31',
        actualStartDate: '2027-01-02',
        actualEndDate: null,
        createdAt: new Date('2026-11-21T10:00:00Z'),
        updatedAt: new Date('2026-11-21T10:00:00Z'),
        ...changes,
      })),
    },
    milestones: {
      findForUpdate: vi.fn().mockResolvedValue(milestone()),
      totalWeightInStage: vi.fn().mockResolvedValue(0),
      nextSequenceInStage: vi.fn().mockResolvedValue(1),
      countNotApprovedInStage: vi.fn().mockResolvedValue(0),
      countOutsideDates: vi.fn().mockResolvedValue(0),
      append: vi.fn(async (_scope, data) => ({
        id: 'milestone-2',
        createdAt: new Date('2026-11-21T10:00:00Z'),
        updatedAt: new Date('2026-11-21T10:00:00Z'),
        ...data,
      })),
      update: vi.fn(async (_scope, id, changes) => ({
        ...milestone(),
        id,
        ...changes,
      })),
    },
    submissions: {
      countForMilestone: vi.fn().mockResolvedValue(0),
      latestForMilestone: vi.fn().mockResolvedValue({
        id: 'submission-1',
        sequence: 1,
        submissionType: EMilestoneSubmissionType.INITIAL,
        submittedById: 'contractor-member',
        submittedByPartyId: 'contractor-party',
      }),
      findInMilestone: vi.fn().mockResolvedValue({
        id: 'submission-1',
        sequence: 1,
        submissionType: EMilestoneSubmissionType.INITIAL,
        submittedById: 'contractor-member',
        submittedByPartyId: 'contractor-party',
      }),
      append: vi.fn(async (_scope, data) => ({ id: 'submission-2', ...data })),
    },
    evidence: { appendMany: vi.fn(async (_scope, rows) => rows) },
    documents: {
      findEvidenceCandidates: vi.fn().mockResolvedValue([
        {
          documentId: '01J0000000000000000000DOC1',
          ownerCompanyId: SCOPE.companyId,
          category: EDocumentCategory.REPORT,
          visibility: EDocumentVisibility.PUBLIC,
          title: 'Photographs',
          currentVersionId: 'version-1',
        },
      ]),
    },
    decisions: {
      latestForMilestone: vi.fn().mockResolvedValue(null),
      findForSubmission: vi.fn().mockResolvedValue(null),
      append: vi.fn(async (_scope, data) => ({ id: 'decision-1', ...data })),
    },
    outstandingItems: {
      listOpenForUpdate: vi.fn().mockResolvedValue([]),
      appendMany: vi.fn(async (_scope, rows) =>
        rows.map((row: object, index: number) => ({
          id: `item-${index + 1}`,
          ...row,
        })),
      ),
      accept: vi.fn().mockResolvedValue(0),
    },
    submissionItems: {
      appendMany: vi.fn(async (_scope, rows) => rows),
      listForSubmissions: vi.fn().mockResolvedValue([]),
    },
    activity: { record: vi.fn().mockResolvedValue(undefined) },
  };
  const unitOfWork: IMilestoneWorkflowUnitOfWork = {
    execute: (operation) =>
      operation(context as unknown as IMilestoneWorkflowContext),
  };
  const reader = {
    findMilestone: vi.fn().mockResolvedValue(milestone()),
    // The submission just written, as the history read returns it.
    submissionHistory: vi.fn().mockResolvedValue([
      {
        submission: {
          id: 'submission-2',
          milestoneId: 'milestone-1',
          sequence: 1,
          submissionType: EMilestoneSubmissionType.INITIAL,
          previousDecisionId: null,
          submittedById: 'member-1',
          submittedAt: new Date('2026-11-21T10:00:00Z'),
          notes: 'Done',
          reportedProgressBps: null,
        },
        evidence: [],
        addressedItemIds: [],
        decision: null,
      },
    ]),
    decisionItems: vi
      .fn()
      .mockResolvedValue({ raised: new Map(), accepted: new Map() }),
    decisions: vi.fn().mockResolvedValue([
      {
        id: 'decision-1',
        milestoneId: 'milestone-1',
        submissionId: 'submission-1',
        decision: EMilestoneDecisionType.APPROVED,
        reason: null,
        approvedBps: 10000,
        cumulativeApprovedBps: 10000,
        approvedWork: null,
        approvedQuantity: 100,
        decidedById: 'member-1',
        decidedAt: new Date('2026-11-21T10:00:00Z'),
      },
    ]),
    stageProgress: vi.fn().mockResolvedValue(new Map()),
  };
  const service = new MilestoneWorkflowService(
    access as unknown as ContractAccessService,
    unitOfWork,
    reader as unknown as IMilestoneWorkflowReader,
  );
  /** Every scope any persistence call received. */
  const scopesUsed = () =>
    Object.values(context).flatMap((port) =>
      Object.values(port).flatMap((fn) =>
        (fn as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]),
      ),
    );
  const writes = () => [
    ...context.stages.append.mock.calls,
    ...context.stages.update.mock.calls,
    ...context.milestones.append.mock.calls,
    ...context.milestones.update.mock.calls,
    ...context.submissions.append.mock.calls,
    ...context.evidence.appendMany.mock.calls,
    ...context.decisions.append.mock.calls,
    ...context.outstandingItems.appendMany.mock.calls,
    ...context.outstandingItems.accept.mock.calls,
    ...context.submissionItems.appendMany.mock.calls,
    ...context.activity.record.mock.calls,
  ];
  return { access, context, reader, service, scopesUsed, writes };
}

const submission = {
  notes: 'Done',
  evidence: [{ documentId: '01J0000000000000000000DOC1' }],
};

describe('MilestoneWorkflowService', () => {
  describe('scope', () => {
    it('authorizes the Project workspace, then queries only with the scope it returned', async () => {
      const { access, context, service, scopesUsed } = setup({
        partyType: EPartyType.AWARDED,
      });
      context.milestones.findForUpdate.mockResolvedValue(
        milestone({ status: EMilestoneStatus.IN_PROGRESS }),
      );

      await service.submit(CALLER, 'milestone-1', submission);

      expect(access.authorize).toHaveBeenCalledWith(
        'user-1',
        'header-company',
        'header-contract',
        'project',
      );
      const scopes = scopesUsed();
      expect(scopes.length).toBeGreaterThan(10);
      for (const scope of scopes) {
        expect(scope).toEqual(SCOPE);
      }
    });

    it('writes nothing when Project access is refused', async () => {
      const { access, service, writes } = setup();
      access.authorize.mockRejectedValue(new NotFoundException());
      await expect(
        service.submit(CALLER, 'milestone-1', submission),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(writes()).toEqual([]);
    });
  });

  describe('roles', () => {
    it('refuses submissions from the client side, even with a Contractor Project Lead role', async () => {
      const { context, service, writes } = setup({
        partyType: EPartyType.AWARDING,
      });
      await expect(
        service.submit(CALLER, 'milestone-1', submission),
      ).rejects.toThrow(
        /Only the contractor’s Contractor Project Lead can submit/,
      );
      expect(
        context.roleAssignments.hasActiveRoleForShare,
      ).not.toHaveBeenCalled();
      expect(writes()).toEqual([]);
    });

    it('refuses planning and decisions from the contractor side', async () => {
      const { service, writes } = setup({ partyType: EPartyType.AWARDED });
      await expect(
        service.createStage(CALLER, {
          name: 'S',
          weightBps: 100,
          plannedStartDate: '2027-01-01',
          plannedEndDate: '2027-02-01',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.decide(CALLER, 'milestone-1', 'submission-1', {
          decision: EMilestoneDecisionType.APPROVED,
        }),
      ).rejects.toThrow(/Client Project Manager can decide/);
      expect(writes()).toEqual([]);
    });

    it('checks the exact role on the caller’s own party', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDING });
      await service.decide(CALLER, 'milestone-1', 'submission-1', {
        decision: EMilestoneDecisionType.APPROVED,
      });
      expect(
        context.roleAssignments.hasActiveRoleForShare,
      ).toHaveBeenCalledWith(
        SCOPE,
        'member-1',
        'party-1',
        EClientContractRole.CLIENT_PROJECT_MANAGER,
      );
    });

    it('refuses a member of the right side without the role', async () => {
      const { service, writes } = setup({
        partyType: EPartyType.AWARDED,
        holdsRole: false,
      });
      await expect(
        service.submit(CALLER, 'milestone-1', submission),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(writes()).toEqual([]);
    });

    it('accepts the awarded party’s Contractor Project Lead as the submitter', async () => {
      const { context, service } = setup({
        partyType: EPartyType.AWARDED,
      });
      context.milestones.findForUpdate.mockResolvedValue(
        milestone({ status: EMilestoneStatus.PLANNED }),
      );
      await service.submit(CALLER, 'milestone-1', submission);
      expect(
        context.roleAssignments.hasActiveRoleForShare,
      ).toHaveBeenCalledWith(
        SCOPE,
        'member-1',
        'party-1',
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      );
    });

    it('refuses a decision made by the submitting side', async () => {
      const { context, service, writes } = setup({
        partyType: EPartyType.AWARDING,
      });
      context.submissions.findInMilestone.mockResolvedValue({
        id: 'submission-1',
        sequence: 1,
        submissionType: EMilestoneSubmissionType.INITIAL,
        submittedById: 'someone-else',
        submittedByPartyId: 'party-1',
      });
      await expect(
        service.decide(CALLER, 'milestone-1', 'submission-1', {
          decision: EMilestoneDecisionType.APPROVED,
        }),
      ).rejects.toThrow(/its own side/);
      expect(writes()).toEqual([]);
    });
  });

  describe('state', () => {
    it('refuses changes to an archived contract before anything is written', async () => {
      const { service, writes } = setup({
        partyType: EPartyType.AWARDED,
        contract: null,
      });
      await expect(
        service.submit(CALLER, 'milestone-1', submission),
      ).rejects.toThrow(/archived/);
      expect(writes()).toEqual([]);
    });

    it('share-locks the stage, not update-locks it, when submitting', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDED });
      context.milestones.findForUpdate.mockResolvedValue(
        milestone({ status: EMilestoneStatus.IN_PROGRESS }),
      );
      await service.submit(CALLER, 'milestone-1', submission);
      expect(context.stages.findForShare).toHaveBeenCalledWith(
        SCOPE,
        'stage-1',
      );
      expect(context.stages.findForUpdate).not.toHaveBeenCalled();
    });

    it('refuses to start a milestone twice', async () => {
      const { context, service, writes } = setup({
        partyType: EPartyType.AWARDED,
      });
      context.milestones.findForUpdate.mockResolvedValue(
        milestone({ status: EMilestoneStatus.IN_PROGRESS }),
      );
      await expect(
        service.startMilestone(CALLER, 'milestone-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(writes()).toEqual([]);
    });

    it('refuses a second decision on a submission', async () => {
      const { context, service, writes } = setup({
        partyType: EPartyType.AWARDING,
      });
      context.decisions.findForSubmission.mockResolvedValue({
        id: 'decision-0',
      });
      await expect(
        service.decide(CALLER, 'milestone-1', 'submission-1', {
          decision: EMilestoneDecisionType.APPROVED,
        }),
      ).rejects.toThrow(/already been decided/);
      expect(writes()).toEqual([]);
    });
  });

  describe('audit', () => {
    it('records each step in the Project workspace, as the checked member, naming the milestone', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDING });
      await service.decide(CALLER, 'milestone-1', 'submission-1', {
        decision: EMilestoneDecisionType.APPROVED,
      });

      const entries = context.activity.record.mock.calls.map(
        ([scope, entry]) => ({
          scope,
          ...entry,
        }),
      );
      expect(entries.map(({ action }) => action)).toEqual([
        'milestone.approved',
        'milestone.completed',
      ]);
      for (const entry of entries) {
        expect(entry).toMatchObject({
          scope: SCOPE,
          contractId: SCOPE.contractId,
          companyId: SCOPE.companyId,
          actorUserId: 'member-1',
          workspace: 'project',
          entityType: 'milestone',
          entityId: 'milestone-1',
        });
      }
      expect(entries[0].metadata).toMatchObject({
        submissionId: 'submission-1',
        decisionId: 'decision-1',
      });
    });

    it('keeps a stage hold’s reason on its entry', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDING });
      await service.transitionStage(CALLER, 'stage-1', {
        status: EStatus.ON_HOLD,
        reason: 'Permit suspended.',
      });
      expect(context.activity.record).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          action: 'stage.status_changed',
          entityType: 'contract_stage',
          entityId: 'stage-1',
          reason: 'Permit suspended.',
          changes: {
            before: { status: EStatus.IN_PROGRESS },
            after: { status: EStatus.ON_HOLD },
          },
        }),
      );
    });
  });

  describe('approved rules (22 November 2026)', () => {
    const newStage = {
      name: 'S',
      weightBps: 100,
      plannedStartDate: '2027-01-01',
      plannedEndDate: '2027-02-01',
    };

    it('allows planning but no operations on a draft contract', async () => {
      const client = setup({
        partyType: EPartyType.AWARDING,
        contractStatus: EContractStatus.DRAFT,
      });
      await client.service.createStage(CALLER, newStage);
      expect(client.context.stages.append).toHaveBeenCalledOnce();
      await expect(
        client.service.decide(CALLER, 'milestone-1', 'submission-1', {
          decision: EMilestoneDecisionType.APPROVED,
        }),
      ).rejects.toThrow(/still a draft/);

      const contractor = setup({
        partyType: EPartyType.AWARDED,
        contractStatus: EContractStatus.DRAFT,
      });
      contractor.context.milestones.findForUpdate.mockResolvedValue(
        milestone({ status: EMilestoneStatus.PLANNED }),
      );
      await expect(
        contractor.service.submit(CALLER, 'milestone-1', submission),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        contractor.service.startMilestone(CALLER, 'milestone-1'),
      ).rejects.toThrow(/still a draft/);
      expect(contractor.writes()).toEqual([]);
    });

    it.each([EContractStatus.SUSPENDED, EContractStatus.COMPLETED])(
      'refuses planning and operations on a %s contract',
      async (contractStatus) => {
        const { service, writes } = setup({
          partyType: EPartyType.AWARDING,
          contractStatus,
        });
        await expect(service.createStage(CALLER, newStage)).rejects.toThrow(
          new RegExp(`is ${contractStatus}`),
        );
        await expect(
          service.transitionStage(CALLER, 'stage-1', {
            status: EStatus.ON_HOLD,
            reason: 'x',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(writes()).toEqual([]);
      },
    );

    it('records calendar days in the contract’s time zone', async () => {
      vi.useFakeTimers();
      // 23:30 UTC on 31 December is already 1 January in Lagos (UTC+1).
      vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
      try {
        const { context, service } = setup({
          partyType: EPartyType.AWARDED,
        });
        context.milestones.findForUpdate.mockResolvedValue(
          milestone({ status: EMilestoneStatus.PLANNED }),
        );
        await service.startMilestone(CALLER, 'milestone-1');
        expect(context.milestones.update).toHaveBeenCalledWith(
          SCOPE,
          'milestone-1',
          expect.objectContaining({ actualStartDate: '2027-01-01' }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('refuses milestone dates outside the stage unless overridden, and records the reason', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDING });
      const request = {
        title: 'Late',
        weightBps: 100,
        dueDate: '2028-03-31',
        isPaymentMilestone: false,
      };
      await expect(
        service.createMilestone(CALLER, 'stage-1', request),
      ).rejects.toThrow(/due date \(2028-03-31\) fall outside the stage/);
      expect(context.milestones.append).not.toHaveBeenCalled();

      await service.createMilestone(CALLER, 'stage-1', {
        ...request,
        dateOverrideReason: 'Handover after the stage closes.',
      });
      expect(context.activity.record).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          action: 'milestone.created',
          reason: 'Handover after the stage closes.',
          metadata: expect.objectContaining({ dateOverride: true }),
        }),
      );
    });

    it('refuses stage dates that would leave milestones outside, unless overridden', async () => {
      const { context, service } = setup({ partyType: EPartyType.AWARDING });
      context.milestones.countOutsideDates.mockResolvedValue(2);
      await expect(
        service.updateStage(CALLER, 'stage-1', {
          plannedEndDate: '2027-03-31',
        }),
      ).rejects.toThrow(/2 milestones would have dates that fall outside/);
      expect(context.stages.update).not.toHaveBeenCalled();

      await service.updateStage(CALLER, 'stage-1', {
        plannedEndDate: '2027-03-31',
        dateOverrideReason: 'Scope moved to phase 2.',
      });
      expect(context.milestones.countOutsideDates).toHaveBeenCalledWith(
        SCOPE,
        'stage-1',
        '2027-01-01',
        '2027-03-31',
      );
      expect(context.activity.record).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({
          action: 'stage.updated',
          reason: 'Scope moved to phase 2.',
          metadata: { dateOverride: true },
        }),
      );
    });
  });
});
