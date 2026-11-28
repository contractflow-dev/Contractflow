import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  contractRoleLabel,
  EClientContractRole,
  EContractStatus,
  EContractorContractRole,
  EDocumentCategory,
  EDocumentVisibility,
  EMilestoneDecisionType,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  EPartyType,
  EStageHistoryEvent,
  EStatus,
  type ContractRole,
  type ContractStage as ContractStageResponse,
  type CreateContractStageRequest,
  type CreateMilestoneRequest,
  type DecideMilestoneSubmissionRequest,
  type SetContractStageApplicabilityRequest,
  type Milestone as MilestoneResponse,
  type MilestoneDecision as MilestoneDecisionResponse,
  type MilestoneSubmission as MilestoneSubmissionResponse,
  type SubmitMilestoneRequest,
  type TransitionContractStageRequest,
  type UpdateContractStageRequest,
  type UpdateMilestoneRequest,
} from '@contractflow/contracts-schema';
import type { ActivityEntryInput } from '../../../common/application/activity-entry';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import type { ContractParty } from '../../contract/entities/contract-party.entity';
import type { Contract } from '../../contract/entities/contract.entity';
import type { CompanyUser } from '../../identity/entities/company-user.entity';
import {
  toContractStageResponse,
  toMilestoneDecisionResponse,
  toMilestoneResponse,
  toMilestoneSubmissionResponse,
} from '../dto/delivery-response.dto';
import type { ContractStage } from '../entities/contract-stage.entity';
import type { Milestone } from '../entities/milestone.entity';
import {
  MILESTONE_WORKFLOW_READER,
  MILESTONE_WORKFLOW_UNIT_OF_WORK,
  type IMilestoneWorkflowContext,
  type IMilestoneWorkflowReader,
  type IMilestoneWorkflowUnitOfWork,
} from '../interface/milestone-workflow-persistence.interface';
import {
  CLOSED_STAGE_STATUSES,
  FULL_BPS,
  assertPlanEditable,
  assertStageWorkAllowed,
  assertMilestoneEditable,
  assertStageTransition,
  assertSubmittable,
  classifySubmission,
  evaluateDecision,
  stageTransitionNeedsReason,
  assertContractAllows,
  dayInTimeZone,
  datesOutsideStage,
  requireDateOverride,
  type ContractAction,
} from './milestone-workflow.rules';

/**
 * Who plans and decides: the awarding party's Client Project Manager (the
 * main contractor's, on a subcontract).
 */
const PLANNER = {
  role: EClientContractRole.CLIENT_PROJECT_MANAGER,
  parties: [EPartyType.AWARDING],
  refusal: (isSubcontract: boolean) =>
    `Only the ${contractRoleLabel(EClientContractRole.CLIENT_PROJECT_MANAGER, isSubcontract)} can`,
} as const;

/**
 * Who performs and submits: the awarded party's Contractor Project Lead
 * (the subcontractor's, on a subcontract).
 */
const SUBMITTER = {
  role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
  parties: [EPartyType.AWARDED],
  refusal: (isSubcontract: boolean) =>
    `Only the ${contractRoleLabel(EContractorContractRole.CONTRACTOR_PROJECT_LEAD, isSubcontract)} can`,
} as const;

/**
 * Evidence must be readable by every Project role on both sides: shared with
 * all parties, and of a category the Project workspace can open (HSE and
 * invoice documents belong to their own workspaces).
 */
const EVIDENCE_CATEGORIES: readonly string[] = [
  EDocumentCategory.CERTIFICATE,
  EDocumentCategory.CONTRACT,
  EDocumentCategory.REPORT,
  EDocumentCategory.OTHER,
];
const MAX_EVIDENCE = 20;

const SCOPE_FIELDS = [
  'title',
  'description',
  'acceptanceCriteria',
  'deliverables',
  'weightBps',
  'targetQuantity',
  'quantityUnit',
  'isPaymentMilestone',
  'amountMinor',
] as const;
const SCHEDULE_FIELDS = [
  'plannedStartDate',
  'dueDate',
  'revisedDueDate',
] as const;

/** The request's identity and headers; access is decided from them. */
interface Caller {
  userId: string;
  companyId: string;
  contractId: string;
}

/** The scope `ContractAccessService.authorize` returned: used for every query. */
type Scope = IContractCompanyScope;

interface Actor {
  member: CompanyUser;
  party: ContractParty;
}

/**
 * Stages and Milestones: the Client Project Manager plans stages and
 * milestones and decides on submissions; the Contractor Project Lead submits
 * the work with evidence. Every change is one transaction with its history
 * rows and its activity entry, so a failed operation leaves no trace.
 *
 * Access is decided twice: `ContractAccessService.authorize` first (the
 * caller must see the contract and hold a Project role, otherwise 404/403
 * exactly as for every Project read), then, inside the transaction, the exact
 * role on the right side of the contract. Company Administrator and Workspace
 * Admin rights grant neither. Every query uses the scope `authorize`
 * returned, never the request's identifiers.
 */
@Injectable()
export class MilestoneWorkflowService {
  constructor(
    private readonly access: ContractAccessService,
    @Inject(MILESTONE_WORKFLOW_UNIT_OF_WORK)
    private readonly unitOfWork: IMilestoneWorkflowUnitOfWork,
    @Inject(MILESTONE_WORKFLOW_READER)
    private readonly reader: IMilestoneWorkflowReader,
  ) {}

  // --- Stages --------------------------------------------------------------

  async createStage(
    caller: Caller,
    request: CreateContractStageRequest,
  ): Promise<ContractStageResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'plan stages',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'update',
        'planning',
      );
      assertPlanEditable(contract);
      assertDateOrder(
        request.plannedStartDate,
        request.plannedEndDate,
        'stage',
      );
      await this.assertStageWeight(context, scope, request.weightBps);
      const stage = await context.stages.append(scope, {
        name: request.name,
        description: request.description ?? null,
        sequence: await context.stages.nextSequence(scope),
        status: EStatus.PLANNED,
        weightBps: request.weightBps,
        plannedStartDate: request.plannedStartDate,
        plannedEndDate: request.plannedEndDate,
        actualStartDate: null,
        actualEndDate: null,
      });
      await this.record(context, scope, actor, {
        action: 'stage.created',
        entityType: 'contract_stage',
        entityId: stage.id,
        summary: `Created stage ${stage.sequence}: ${stage.name}.`,
        changes: { before: null, after: stagePlan(stage) },
        occurredAt: new Date(),
      });
      await this.recordStageHistory(context, scope, actor, stage, {
        eventType: EStageHistoryEvent.INITIALISED,
        toStatus: stage.status,
        toApplicable: true,
        toWeightBps: stage.weightBps,
      });
      return toContractStageResponse(stage);
    });
  }

  async updateStage(
    caller: Caller,
    stageId: string,
    request: UpdateContractStageRequest,
  ): Promise<ContractStageResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'change stages',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'update',
        'planning',
      );
      const stage = await this.lockStage(context, scope, stageId);
      assertStageWorkAllowed(contract, stage);
      if (CLOSED_STAGE_STATUSES.includes(stage.status)) {
        throw new ConflictException('A completed stage can no longer change.');
      }
      // A copy to validate and compare; only the changed fields are written.
      const next = { ...stage } as ContractStage;
      if (request.name !== undefined) next.name = request.name;
      if (request.description !== undefined) {
        next.description = request.description ?? null;
      }
      if (request.plannedStartDate !== undefined) {
        next.plannedStartDate = request.plannedStartDate;
      }
      if (request.plannedEndDate !== undefined) {
        next.plannedEndDate = request.plannedEndDate;
      }
      assertDateOrder(next.plannedStartDate, next.plannedEndDate, 'stage');
      let dateOverride: string | null = null;
      if (
        next.plannedStartDate !== stage.plannedStartDate ||
        next.plannedEndDate !== stage.plannedEndDate
      ) {
        const outside = await context.milestones.countOutsideDates(
          scope,
          stage.id,
          next.plannedStartDate,
          next.plannedEndDate,
        );
        dateOverride = requireDateOverride(
          outside
            ? [
                `${outside} milestone${outside === 1 ? '' : 's'} would have dates that`,
              ]
            : [],
          request.dateOverrideReason,
          'With these dates,',
        );
      }
      if (
        request.weightBps !== undefined &&
        request.weightBps !== stage.weightBps
      ) {
        assertPlanEditable(contract);
        await this.assertStageWeight(
          context,
          scope,
          request.weightBps,
          stage.id,
        );
        next.weightBps = request.weightBps;
      }
      const changes = diff(stagePlan(stage), stagePlan(next));
      if (!changes) return this.stageResponse(scope, stage);
      const saved = await context.stages.update(
        scope,
        stage.id,
        changes.after as Partial<ContractStage>,
      );
      await this.record(context, scope, actor, {
        action: 'stage.updated',
        entityType: 'contract_stage',
        entityId: saved.id,
        summary: `Updated stage ${saved.sequence}: ${saved.name}.`,
        changes,
        ...(dateOverride
          ? { reason: dateOverride, metadata: { dateOverride: true } }
          : {}),
        occurredAt: new Date(),
      });
      if (saved.weightBps !== stage.weightBps) {
        await this.recordStageHistory(context, scope, actor, saved, {
          eventType: EStageHistoryEvent.WEIGHT_CHANGED,
          fromWeightBps: stage.weightBps,
          toWeightBps: saved.weightBps,
        });
      }
      if (
        saved.plannedStartDate !== stage.plannedStartDate ||
        saved.plannedEndDate !== stage.plannedEndDate
      ) {
        await this.recordStageHistory(context, scope, actor, saved, {
          eventType: EStageHistoryEvent.DATES_CHANGED,
          reason: dateOverride,
        });
      }
      return this.stageResponse(scope, saved);
    });
  }

  async transitionStage(
    caller: Caller,
    stageId: string,
    request: TransitionContractStageRequest,
  ): Promise<ContractStageResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'change a stage’s status',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'operation',
      );
      const stage = await this.lockStage(context, scope, stageId);
      assertStageWorkAllowed(contract, stage);
      if (stage.isApplicable === false) {
        throw new ConflictException(
          'This stage doesn’t apply to the contract; reinstate it before changing its status.',
        );
      }
      const from = stage.status;
      const to = request.status;
      assertStageTransition(from, to);
      const reason = request.reason?.trim() || null;
      if (stageTransitionNeedsReason(from, to) && !reason) {
        throw new BadRequestException(
          to === EStatus.ON_HOLD
            ? 'Putting a stage on hold needs a reason.'
            : to === EStatus.CANCELLED
              ? 'Cancelling a stage needs a reason.'
              : 'Resuming a stage needs a reason.',
        );
      }
      const day = request.effectiveDate ?? contractDay(contract);
      const changes: Partial<ContractStage> = { status: to };
      if (from === EStatus.PLANNED && to === EStatus.IN_PROGRESS) {
        changes.actualStartDate = day;
      }
      if (to === EStatus.COMPLETED) {
        const open = await context.milestones.countNotApprovedInStage(
          scope,
          stage.id,
        );
        if (open > 0) {
          throw new ConflictException(
            `A stage completes once all its milestones are approved; ${open} ${open === 1 ? 'is' : 'are'} not.`,
          );
        }
        if (stage.actualStartDate && day < stage.actualStartDate) {
          throw new BadRequestException('A stage can’t end before it started.');
        }
        changes.actualEndDate = day;
      }
      const saved = await context.stages.update(scope, stage.id, changes);
      await this.record(context, scope, actor, {
        action:
          to === EStatus.COMPLETED ? 'stage.completed' : 'stage.status_changed',
        entityType: 'contract_stage',
        entityId: saved.id,
        summary: `Moved stage ${saved.sequence}: ${saved.name} from ${spaced(from)} to ${spaced(to)}.`,
        changes: { before: { status: from }, after: changes },
        reason,
        occurredAt: new Date(),
      });
      await this.recordStageHistory(context, scope, actor, saved, {
        eventType: EStageHistoryEvent.STATUS_CHANGED,
        fromStatus: from,
        toStatus: to,
        reason,
      });
      return this.stageResponse(scope, saved);
    });
  }

  // --- Milestones ----------------------------------------------------------

  async createMilestone(
    caller: Caller,
    stageId: string,
    request: CreateMilestoneRequest,
  ): Promise<MilestoneResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'create milestones',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'planning',
      );
      const stage = await this.lockStage(context, scope, stageId);
      assertStageWorkAllowed(contract, stage);
      if (CLOSED_STAGE_STATUSES.includes(stage.status)) {
        throw new ConflictException(
          'A completed stage takes no new milestones.',
        );
      }
      if (stage.isApplicable === false) {
        throw new ConflictException(
          'This stage doesn’t apply to the contract, so it takes no milestones.',
        );
      }
      await this.assertMilestoneWeight(
        context,
        scope,
        stage.id,
        request.weightBps,
      );
      assertTarget(
        request.targetQuantity ?? null,
        request.quantityUnit ?? null,
      );
      assertPayment(request.isPaymentMilestone, request.amountMinor ?? null);
      if (request.plannedStartDate) {
        assertDateOrder(request.plannedStartDate, request.dueDate, 'milestone');
      }
      const dateOverride = requireDateOverride(
        datesOutsideStage(stage, {
          plannedStartDate: request.plannedStartDate ?? null,
          dueDate: request.dueDate,
        }),
        request.dateOverrideReason,
        'The milestone’s',
      );
      const milestone = await context.milestones.append(scope, {
        contractStageId: stage.id,
        title: request.title,
        description: request.description ?? null,
        acceptanceCriteria: request.acceptanceCriteria ?? null,
        deliverables: request.deliverables ?? null,
        sequence: await context.milestones.nextSequenceInStage(scope, stage.id),
        status: EMilestoneStatus.PLANNED,
        progressBps: 0,
        approvedBps: 0,
        weightBps: request.weightBps,
        targetQuantity: request.targetQuantity ?? null,
        quantityUnit: request.quantityUnit ?? null,
        approvedQuantity: request.targetQuantity ? 0 : null,
        isPaymentMilestone: request.isPaymentMilestone,
        amountMinor: request.amountMinor ?? null,
        // The contract's currency; a milestone has no currency of its own.
        currencyCode: request.amountMinor ? contract.currencyCode : null,
        plannedStartDate: request.plannedStartDate ?? null,
        actualStartDate: null,
        dueDate: request.dueDate,
        revisedDueDate: null,
        completedDate: null,
        submittedAt: null,
        submittedById: null,
        approvedAt: null,
        approvedById: null,
        rejectionReason: null,
      });
      await this.record(context, scope, actor, {
        action: 'milestone.created',
        entityType: 'milestone',
        entityId: milestone.id,
        summary: `Created milestone ${milestone.title} in stage ${stage.name}.`,
        changes: { before: null, after: milestonePlan(milestone) },
        metadata: {
          contractStageId: stage.id,
          ...(dateOverride ? { dateOverride: true } : {}),
        },
        ...(dateOverride ? { reason: dateOverride } : {}),
        occurredAt: new Date(),
      });
      return toMilestoneResponse(milestone, contractDay(contract));
    });
  }

  async updateMilestone(
    caller: Caller,
    milestoneId: string,
    request: UpdateMilestoneRequest,
  ): Promise<MilestoneResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'change milestones',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'planning',
      );
      const milestone = await this.lockMilestone(context, scope, milestoneId);
      await this.assertMilestoneStageOpen(context, scope, contract, milestone);
      const changesScope = SCOPE_FIELDS.some(
        (field) => request[field] !== undefined,
      );
      const hasSubmissions =
        (await context.submissions.countForMilestone(scope, milestone.id)) > 0;
      assertMilestoneEditable(milestone.status, hasSubmissions, changesScope);
      if (request.dueDate === null) {
        throw new BadRequestException('A milestone needs a due date.');
      }

      // A copy to validate and compare; only the changed fields are written.
      const next = { ...milestone } as Milestone;
      for (const field of [...SCOPE_FIELDS, ...SCHEDULE_FIELDS]) {
        const value = request[field];
        if (value !== undefined) {
          (next as unknown as Record<string, unknown>)[field] = value ?? null;
        }
      }
      if (request.weightBps !== undefined) {
        await this.assertMilestoneWeight(
          context,
          scope,
          milestone.contractStageId,
          request.weightBps,
          milestone.id,
        );
      }
      assertTarget(next.targetQuantity, next.quantityUnit);
      if (request.targetQuantity !== undefined) {
        next.approvedQuantity = next.targetQuantity ? 0 : null;
      }
      assertPayment(next.isPaymentMilestone, next.amountMinor);
      next.currencyCode = next.amountMinor ? contract.currencyCode : null;
      if (next.plannedStartDate) {
        assertDateOrder(next.plannedStartDate, next.dueDate, 'milestone');
      }
      if (next.revisedDueDate && next.revisedDueDate < next.dueDate) {
        throw new BadRequestException(
          'The revised due date can’t be before the original due date.',
        );
      }
      let dateOverride: string | null = null;
      if (
        next.plannedStartDate !== milestone.plannedStartDate ||
        next.dueDate !== milestone.dueDate
      ) {
        const stage = await context.stages.findForShare(
          scope,
          milestone.contractStageId,
        );
        if (stage) {
          dateOverride = requireDateOverride(
            datesOutsideStage(stage, next),
            request.dateOverrideReason,
            'The milestone’s',
          );
        }
      }
      const changes = diff(milestonePlan(milestone), milestonePlan(next));
      if (!changes)
        return toMilestoneResponse(milestone, contractDay(contract));
      const saved = await context.milestones.update(scope, milestone.id, {
        ...(changes.after as Partial<Milestone>),
        approvedQuantity: next.approvedQuantity,
        currencyCode: next.currencyCode,
      });
      await this.record(context, scope, actor, {
        action: 'milestone.updated',
        entityType: 'milestone',
        entityId: saved.id,
        summary: `Updated milestone ${saved.title}.`,
        changes,
        ...(dateOverride
          ? { reason: dateOverride, metadata: { dateOverride: true } }
          : {}),
        occurredAt: new Date(),
      });
      return toMilestoneResponse(saved, contractDay(contract));
    });
  }

  /** The contractor starts work: planned → in progress, with the actual start day. */
  async startMilestone(
    caller: Caller,
    milestoneId: string,
  ): Promise<MilestoneResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        SUBMITTER,
        'start work on a milestone',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'operation',
      );
      const milestone = await this.lockMilestone(context, scope, milestoneId);
      await this.assertMilestoneStageOpen(context, scope, contract, milestone);
      if (milestone.status !== EMilestoneStatus.PLANNED) {
        throw new ConflictException('Only a planned milestone can be started.');
      }
      await this.assertStageOpen(context, scope, milestone.contractStageId);
      const changes = {
        status: EMilestoneStatus.IN_PROGRESS,
        actualStartDate: contractDay(contract),
      };
      const saved = await context.milestones.update(
        scope,
        milestone.id,
        changes,
      );
      await this.record(context, scope, actor, {
        action: 'milestone.started',
        entityType: 'milestone',
        entityId: saved.id,
        summary: `Started work on milestone ${saved.title}.`,
        changes: {
          before: { status: EMilestoneStatus.PLANNED },
          after: changes,
        },
        occurredAt: new Date(),
      });
      return toMilestoneResponse(saved, contractDay(contract));
    });
  }

  // --- Submissions ---------------------------------------------------------

  async submit(
    caller: Caller,
    milestoneId: string,
    request: SubmitMilestoneRequest,
  ): Promise<MilestoneSubmissionResponse> {
    const scope = await this.authorizeProject(caller);
    const submissionId = await this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        SUBMITTER,
        'submit milestone work',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'operation',
      );
      const milestone = await this.lockMilestone(context, scope, milestoneId);
      await this.assertMilestoneStageOpen(context, scope, contract, milestone);
      assertSubmittable(milestone.status);
      await this.assertStageOpen(context, scope, milestone.contractStageId);

      const [openItems, latestDecision] = await Promise.all([
        context.outstandingItems.listOpenForUpdate(scope, milestone.id),
        context.decisions.latestForMilestone(scope, milestone.id),
      ]);
      const kind = classifySubmission({
        latestDecision,
        openItems,
        requestedItemIds: request.outstandingItemIds ?? [],
      });
      const evidence = await this.resolveEvidence(
        context,
        scope,
        actor,
        request,
      );

      const now = new Date();
      const previous = milestone.status;
      const submission = await context.submissions.append(scope, {
        milestoneId: milestone.id,
        sequence:
          (await context.submissions.countForMilestone(scope, milestone.id)) +
          1,
        submissionType: kind.submissionType,
        previousDecisionId: kind.previousDecisionId,
        submittedById: actor.member.id,
        submittedByPartyId: actor.party.id,
        submittedAt: now,
        notes: request.notes,
        reportedProgressBps: request.reportedProgressBps ?? null,
      });
      await context.evidence.appendMany(
        scope,
        evidence.map((item, index) => ({
          submissionId: submission.id,
          documentId: item.documentId,
          documentVersionId: item.versionId,
          caption: item.caption,
          position: index + 1,
        })),
      );
      if (kind.addressedItemIds.length) {
        await context.submissionItems.appendMany(
          scope,
          kind.addressedItemIds.map((outstandingItemId) => ({
            submissionId: submission.id,
            outstandingItemId,
          })),
        );
      }

      await context.milestones.update(scope, milestone.id, {
        status: EMilestoneStatus.PENDING_APPROVAL,
        submittedAt: now,
        submittedById: actor.member.id,
        actualStartDate:
          milestone.actualStartDate ?? contractDay(contract, now),
        ...(request.reportedProgressBps != null
          ? { progressBps: request.reportedProgressBps }
          : {}),
      });

      const resubmitted =
        kind.submissionType !== EMilestoneSubmissionType.INITIAL;
      const items = kind.addressedItemIds.length;
      await this.record(context, scope, actor, {
        action: resubmitted ? 'milestone.resubmitted' : 'milestone.submitted',
        entityType: 'milestone',
        entityId: milestone.id,
        summary:
          kind.submissionType === EMilestoneSubmissionType.OUTSTANDING_WORK
            ? `Resubmitted ${items} outstanding item${items === 1 ? '' : 's'} of milestone ${milestone.title} for review.`
            : resubmitted
              ? `Resubmitted milestone ${milestone.title} for review.`
              : `Submitted milestone ${milestone.title} for review.`,
        changes: {
          before: { status: previous },
          after: { status: EMilestoneStatus.PENDING_APPROVAL },
        },
        metadata: {
          submissionId: submission.id,
          sequence: submission.sequence,
          submissionType: submission.submissionType,
          ...(submission.previousDecisionId
            ? { previousDecisionId: submission.previousDecisionId }
            : {}),
          ...(items ? { outstandingItemIds: kind.addressedItemIds } : {}),
        },
        occurredAt: now,
      });
      await this.record(context, scope, actor, {
        action: 'milestone.evidence_attached',
        entityType: 'milestone',
        entityId: milestone.id,
        summary: `Attached ${evidence.length} evidence file${evidence.length === 1 ? '' : 's'} to submission ${submission.sequence} of milestone ${milestone.title}.`,
        metadata: {
          submissionId: submission.id,
          evidence: evidence.map(({ documentId, versionId }) => ({
            documentId,
            documentVersionId: versionId,
          })),
        },
        occurredAt: now,
      });
      return submission.id;
    });
    return this.submissionResponse(scope, milestoneId, submissionId);
  }

  // --- Decisions -----------------------------------------------------------

  async decide(
    caller: Caller,
    milestoneId: string,
    submissionId: string,
    request: DecideMilestoneSubmissionRequest,
  ): Promise<MilestoneDecisionResponse> {
    const scope = await this.authorizeProject(caller);
    const decisionId = await this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'decide on milestone submissions',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'share',
        'operation',
      );
      // The milestone lock serializes decisions and submissions.
      const milestone = await this.lockMilestone(context, scope, milestoneId);
      await this.assertMilestoneStageOpen(context, scope, contract, milestone);
      const submission = await context.submissions.findInMilestone(
        scope,
        milestone.id,
        submissionId,
      );
      if (!submission) {
        throw new NotFoundException('Submission was not found.');
      }
      if (await context.decisions.findForSubmission(scope, submission.id)) {
        throw new ConflictException(
          'This submission has already been decided.',
        );
      }
      const latest = await context.submissions.latestForMilestone(
        scope,
        milestone.id,
      );
      if (
        latest?.id !== submission.id ||
        milestone.status !== EMilestoneStatus.PENDING_APPROVAL
      ) {
        throw new ConflictException(
          'Only the latest submission, while it waits for review, can be decided.',
        );
      }
      // Never one's own work: the decision-maker is on the client side by
      // role, and is also checked against the submitter.
      if (
        submission.submittedById === actor.member.id ||
        submission.submittedByPartyId === actor.party.id
      ) {
        throw new ForbiddenException(
          'A submission can’t be decided by its own side.',
        );
      }

      const openItems = await context.outstandingItems.listOpenForUpdate(
        scope,
        milestone.id,
      );
      const covered = new Set(
        (
          await context.submissionItems.listForSubmissions(scope, [
            submission.id,
          ])
        ).map(({ outstandingItemId }) => outstandingItemId),
      );
      const addressedItems = openItems
        .filter((item) => covered.has(item.id))
        .map(({ id, quantity }) => ({ id, quantity }));
      if (addressedItems.length !== covered.size) {
        // An item the submission covers was accepted meanwhile.
        throw new ConflictException(
          'The outstanding items of this submission have changed; reload and review again.',
        );
      }

      const outcome = evaluateDecision(request, {
        submissionType: submission.submissionType,
        approvedBps: milestone.approvedBps ?? 0,
        approvedQuantity: milestone.approvedQuantity ?? null,
        targetQuantity: milestone.targetQuantity ?? null,
        addressedItems,
      });

      const now = new Date();
      let decision;
      try {
        decision = await context.decisions.append(scope, {
          milestoneId: milestone.id,
          submissionId: submission.id,
          decision: outcome.decision,
          reason: outcome.reason,
          approvedBps: outcome.approvedBps,
          cumulativeApprovedBps: outcome.cumulativeApprovedBps,
          approvedWork: outcome.approvedWork,
          approvedQuantity: outcome.approvedQuantity,
          decidedById: actor.member.id,
          decidedByPartyId: actor.party.id,
          decidedAt: now,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(
            'This submission has already been decided.',
          );
        }
        throw error;
      }
      const raised = outcome.newItems.length
        ? await context.outstandingItems.appendMany(
            scope,
            outcome.newItems.map((item, index) => ({
              milestoneId: milestone.id,
              raisedByDecisionId: decision.id,
              description: item.description,
              quantity: item.quantity ?? null,
              position: index + 1,
              acceptedByDecisionId: null,
              acceptedAt: null,
            })),
          )
        : [];
      if (outcome.acceptedItemIds.length) {
        const accepted = await context.outstandingItems.accept(
          scope,
          outcome.acceptedItemIds,
          decision.id,
          now,
        );
        if (accepted !== outcome.acceptedItemIds.length) {
          throw new ConflictException(
            'The outstanding items of this submission have changed; reload and review again.',
          );
        }
      }

      const updated = await context.milestones.update(scope, milestone.id, {
        status: outcome.milestoneStatus,
        approvedBps: outcome.cumulativeApprovedBps,
        approvedQuantity: outcome.cumulativeApprovedQuantity,
        ...(outcome.decision === EMilestoneDecisionType.REJECTED
          ? { rejectionReason: outcome.reason }
          : {}),
        ...(outcome.decision === EMilestoneDecisionType.APPROVED
          ? {
              approvedAt: now,
              approvedById: actor.member.id,
              completedDate: contractDay(contract, now),
            }
          : {}),
      });

      const action = {
        [EMilestoneDecisionType.APPROVED]: 'milestone.approved',
        [EMilestoneDecisionType.PARTIALLY_APPROVED]:
          'milestone.partially_approved',
        [EMilestoneDecisionType.REJECTED]: 'milestone.rejected',
      }[outcome.decision];
      await this.record(context, scope, actor, {
        action,
        entityType: 'milestone',
        entityId: milestone.id,
        summary: decisionSummary(
          updated,
          submission.sequence,
          outcome.decision,
        ),
        changes: {
          before: {
            status: milestone.status,
            approvedBps: milestone.approvedBps,
          },
          after: {
            status: updated.status,
            approvedBps: updated.approvedBps,
            ...(updated.targetQuantity !== null
              ? { approvedQuantity: updated.approvedQuantity }
              : {}),
          },
        },
        metadata: {
          submissionId: submission.id,
          decisionId: decision.id,
          ...(raised.length
            ? { raisedItemIds: raised.map(({ id }) => id) }
            : {}),
          ...(outcome.acceptedItemIds.length
            ? { acceptedItemIds: outcome.acceptedItemIds }
            : {}),
        },
        reason: outcome.reason,
        occurredAt: now,
      });
      if (
        outcome.decision === EMilestoneDecisionType.PARTIALLY_APPROVED &&
        outcome.acceptedItemIds.length
      ) {
        await this.record(context, scope, actor, {
          action: 'milestone.outstanding_items_updated',
          entityType: 'milestone',
          entityId: milestone.id,
          summary: `Accepted ${outcome.acceptedItemIds.length} of ${addressedItems.length} outstanding items of milestone ${milestone.title}.`,
          metadata: {
            decisionId: decision.id,
            acceptedItemIds: outcome.acceptedItemIds,
            stillOutstandingItemIds: addressedItems
              .map(({ id }) => id)
              .filter((id) => !outcome.acceptedItemIds.includes(id)),
          },
          occurredAt: now,
        });
      }
      if (outcome.decision === EMilestoneDecisionType.APPROVED) {
        await this.record(context, scope, actor, {
          action: 'milestone.completed',
          entityType: 'milestone',
          entityId: milestone.id,
          summary: `Milestone ${milestone.title} is complete: all its work is accepted.`,
          changes: {
            before: null,
            after: { completedDate: updated.completedDate },
          },
          metadata: { decisionId: decision.id },
          occurredAt: now,
        });
      }
      return decision.id;
    });
    const decisions = await this.reader.decisions(scope, milestoneId);
    const decision = decisions.find(({ id }) => id === decisionId);
    if (!decision) throw new NotFoundException('Decision was not found.');
    const items = await this.reader.decisionItems(scope, [decisionId]);
    return toMilestoneDecisionResponse(decision, items);
  }

  // --- Reads -----------------------------------------------------------------

  async getSubmission(
    caller: Caller,
    milestoneId: string,
    submissionId: string,
  ): Promise<MilestoneSubmissionResponse> {
    const scope = await this.authorizeProject(caller);
    return this.submissionResponse(scope, milestoneId, submissionId);
  }

  async listSubmissions(
    caller: Caller,
    milestoneId: string,
  ): Promise<MilestoneSubmissionResponse[]> {
    const scope = await this.authorizeProject(caller);
    return this.submissionHistory(scope, milestoneId);
  }

  // --- Helpers ---------------------------------------------------------------

  /** Project workspace access; the scope it returns is used for every query. */
  private async authorizeProject(caller: Caller): Promise<Scope> {
    const scope = await this.access.authorize(
      caller.userId,
      caller.companyId,
      caller.contractId,
      'project',
    );
    return { contractId: scope.contractId, companyId: scope.companyId };
  }

  private async submissionHistory(
    scope: Scope,
    milestoneId: string,
  ): Promise<MilestoneSubmissionResponse[]> {
    if (!(await this.reader.findMilestone(scope, milestoneId))) {
      throw new NotFoundException('Milestone was not found.');
    }
    const history = await this.reader.submissionHistory(scope, milestoneId);
    const items = await this.reader.decisionItems(
      scope,
      history.flatMap(({ decision }) => (decision ? [decision.id] : [])),
    );
    return history.map((record) =>
      toMilestoneSubmissionResponse(record, items),
    );
  }

  private async submissionResponse(
    scope: Scope,
    milestoneId: string,
    submissionId: string,
  ): Promise<MilestoneSubmissionResponse> {
    const submission = (await this.submissionHistory(scope, milestoneId)).find(
      ({ id }) => id === submissionId,
    );
    if (!submission) throw new NotFoundException('Submission was not found.');
    return submission;
  }

  /** The caller's exact role on the right side of the contract, checked in the transaction. */
  private async requireRole(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    caller: Caller,
    required: {
      role: ContractRole;
      parties: readonly EPartyType[];
      refusal: (isSubcontract: boolean) => string;
    },
    what: string,
  ): Promise<Actor> {
    const member = await context.memberships.findActiveForUpdate(
      scope,
      caller.userId,
    );
    if (!member) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await context.parties.findOwnForShare(scope);
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const holdsRole =
      required.parties.includes(party.partyType) &&
      (await context.roleAssignments.hasActiveRoleForShare(
        scope,
        member.id,
        party.id,
        required.role,
      ));
    if (!holdsRole) {
      // Named the subcontract way on a subcontract.
      const contract = await context.contracts.findActiveForLock(
        scope,
        member.id,
        'share',
      );
      throw new ForbiddenException(
        `${required.refusal(Boolean(contract?.parentContractId))} ${what}.`,
      );
    }
    return { member, party };
  }

  /**
   * The contract, locked: `share` keeps it from being archived meanwhile,
   * `update` also serializes stage planning so weights stay within 100%.
   */
  /**
   * Marks a planned stage, with no milestones, as not applying to the
   * contract, with a reason; or reinstates it while it is still planned
   * (decision D-7). Progress leaves out a stage that doesn't apply.
   */
  async setStageApplicability(
    caller: Caller,
    stageId: string,
    request: SetContractStageApplicabilityRequest,
  ): Promise<ContractStageResponse> {
    const scope = await this.authorizeProject(caller);
    return this.unitOfWork.execute(async (context) => {
      const actor = await this.requireRole(
        context,
        scope,
        caller,
        PLANNER,
        'decide whether a stage applies',
      );
      const contract = await this.lockContract(
        context,
        scope,
        actor,
        'update',
        'planning',
      );
      const stage = await this.lockStage(context, scope, stageId);
      assertStageWorkAllowed(contract, stage);
      if ((stage.isApplicable ?? true) === request.isApplicable) {
        return this.stageResponse(scope, stage);
      }
      if (stage.status !== EStatus.PLANNED) {
        throw new ConflictException(
          'Only a stage that hasn’t started can be marked as not applying or reinstated.',
        );
      }
      const reason = request.reason?.trim() || null;
      if (!request.isApplicable) {
        if (!reason) {
          throw new BadRequestException(
            'Say why the stage doesn’t apply to this contract.',
          );
        }
        if (
          (await context.milestones.countActiveInStage(scope, stage.id)) > 0
        ) {
          throw new ConflictException(
            'This stage has milestones; cancel them before marking the stage as not applying.',
          );
        }
      }
      const now = new Date();
      const saved = await context.stages.update(scope, stage.id, {
        isApplicable: request.isApplicable,
        applicabilityReason: request.isApplicable ? null : reason,
        applicabilityDecidedById: actor.member.id,
        applicabilityDecidedAt: now,
      });
      await this.record(context, scope, actor, {
        action: 'stage.applicability_changed',
        entityType: 'contract_stage',
        entityId: saved.id,
        summary: request.isApplicable
          ? `Reinstated stage ${saved.sequence}: ${saved.name}.`
          : `Marked stage ${saved.sequence}: ${saved.name} as not applying.`,
        changes: {
          before: { isApplicable: stage.isApplicable ?? true },
          after: { isApplicable: request.isApplicable },
        },
        reason,
        occurredAt: now,
      });
      await this.recordStageHistory(context, scope, actor, saved, {
        eventType: EStageHistoryEvent.APPLICABILITY_CHANGED,
        fromApplicable: stage.isApplicable ?? true,
        toApplicable: request.isApplicable,
        reason,
      });
      return this.stageResponse(scope, saved);
    });
  }

  /** One stage history row, in the transaction of the change it records. */
  private async recordStageHistory(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    actor: Actor,
    stage: ContractStage,
    event: {
      eventType: EStageHistoryEvent;
      fromStatus?: EStatus | null;
      toStatus?: EStatus | null;
      fromApplicable?: boolean | null;
      toApplicable?: boolean | null;
      fromWeightBps?: number | null;
      toWeightBps?: number | null;
      reason?: string | null;
    },
  ): Promise<void> {
    await context.stageHistory.record(scope, {
      contractStageId: stage.id,
      eventType: event.eventType,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      fromApplicable: event.fromApplicable ?? null,
      toApplicable: event.toApplicable ?? null,
      fromWeightBps: event.fromWeightBps ?? null,
      toWeightBps: event.toWeightBps ?? null,
      reason: event.reason ?? null,
      actorCompanyUserId: actor.member.id,
      occurredAt: new Date(),
    });
  }

  /**
   * During the defects liability period, a milestone changes only in the
   * post-contract obligations stage. Other statuses need no extra read.
   */
  private async assertMilestoneStageOpen(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    contract: Contract,
    milestone: Milestone,
  ): Promise<void> {
    if (contract.status !== EContractStatus.DEFECTS_LIABILITY) return;
    const stage = await context.stages.findForShare(
      scope,
      milestone.contractStageId,
    );
    if (!stage) throw new NotFoundException('Stage was not found.');
    assertStageWorkAllowed(contract, stage);
  }

  private async lockContract(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    actor: Actor,
    mode: 'share' | 'update',
    action: ContractAction,
  ): Promise<Contract> {
    const contract = await context.contracts.findActiveForLock(
      scope,
      actor.member.id,
      mode,
    );
    if (!contract) {
      throw new ConflictException(
        'This contract is archived; its stages and milestones can’t change.',
      );
    }
    // Draft: planning only; active: everything; suspended and completed:
    // nothing (approved 22 November 2026).
    assertContractAllows(contract.status, action);
    return contract;
  }

  private async lockStage(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    stageId: string,
  ): Promise<ContractStage> {
    const stage = await context.stages.findForUpdate(scope, stageId);
    if (!stage) throw new NotFoundException('Stage was not found.');
    return stage;
  }

  private async lockMilestone(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    milestoneId: string,
  ): Promise<Milestone> {
    const milestone = await context.milestones.findForUpdate(
      scope,
      milestoneId,
    );
    if (!milestone) throw new NotFoundException('Milestone was not found.');
    return milestone;
  }

  /** Share-locked: the stage can't be held or closed while work is submitted. */
  private async assertStageOpen(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    stageId: string,
  ): Promise<void> {
    const stage = await context.stages.findForShare(scope, stageId);
    if (stage?.status === EStatus.ON_HOLD) {
      throw new ConflictException(
        'This milestone’s stage is on hold; work can’t be started or submitted.',
      );
    }
    if (stage && CLOSED_STAGE_STATUSES.includes(stage.status)) {
      throw new ConflictException('This milestone’s stage is closed.');
    }
  }

  private async assertStageWeight(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    weightBps: number,
    excludeStageId?: string,
  ): Promise<void> {
    const others = await context.stages.totalWeight(scope, excludeStageId);
    if (others + weightBps > FULL_BPS) {
      throw new BadRequestException(
        `The contract’s stages would weigh ${(others + weightBps) / 100}% in total; they can add up to 100% at most.`,
      );
    }
  }

  private async assertMilestoneWeight(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    stageId: string,
    weightBps: number,
    excludeMilestoneId?: string,
  ): Promise<void> {
    const others = await context.milestones.totalWeightInStage(
      scope,
      stageId,
      excludeMilestoneId,
    );
    if (others + weightBps > FULL_BPS) {
      throw new BadRequestException(
        `The stage’s milestones would weigh ${(others + weightBps) / 100}% in total; they can add up to 100% at most.`,
      );
    }
  }

  /**
   * Each evidence document must be this contract's, uploaded by the
   * submitter's company, shared with every party, readable in the Project
   * workspace, and have an available version, which is kept.
   */
  private async resolveEvidence(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    actor: Actor,
    request: SubmitMilestoneRequest,
  ): Promise<
    Array<{ documentId: string; versionId: string; caption: string | null }>
  > {
    const references = request.evidence ?? [];
    if (!references.length) {
      throw new BadRequestException(
        'A submission needs at least one evidence file.',
      );
    }
    if (references.length > MAX_EVIDENCE) {
      throw new BadRequestException(
        `A submission can have at most ${MAX_EVIDENCE} evidence files.`,
      );
    }
    const ids = references.map(({ documentId }) => documentId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Each evidence document can be attached once.',
      );
    }
    const candidates = new Map(
      (await context.documents.findEvidenceCandidates(scope, ids)).map(
        (candidate) => [candidate.documentId, candidate],
      ),
    );
    return references.map((reference) => {
      const candidate = candidates.get(reference.documentId);
      // Another company's or another contract's document is "not found".
      if (!candidate || candidate.ownerCompanyId !== actor.member.companyId) {
        throw new BadRequestException(
          'Evidence must be documents your company uploaded to this contract.',
        );
      }
      if (candidate.visibility !== EDocumentVisibility.PUBLIC) {
        throw new BadRequestException(
          `“${candidate.title}” is visible to your company only; share it with all parties so the client can review it.`,
        );
      }
      if (!EVIDENCE_CATEGORIES.includes(candidate.category)) {
        throw new BadRequestException(
          `“${candidate.title}” belongs to another workspace; use a contract, certificate, report or other document.`,
        );
      }
      if (!candidate.currentVersionId) {
        throw new BadRequestException(
          `“${candidate.title}” has no finished upload yet.`,
        );
      }
      return {
        documentId: candidate.documentId,
        versionId: candidate.currentVersionId,
        caption: reference.caption?.trim() || null,
      };
    });
  }

  private async stageResponse(
    scope: Scope,
    stage: ContractStage,
  ): Promise<ContractStageResponse> {
    const progress = await this.reader.stageProgress(scope, [stage.id]);
    return toContractStageResponse(stage, progress.get(stage.id) ?? 0);
  }

  private record(
    context: IMilestoneWorkflowContext,
    scope: Scope,
    actor: Actor,
    entry: Omit<
      ActivityEntryInput,
      'contractId' | 'companyId' | 'actorUserId' | 'workspace'
    >,
  ): Promise<void> {
    return context.activity.record(scope, {
      ...entry,
      contractId: scope.contractId,
      // The acting company and membership come from the checked context.
      companyId: actor.member.companyId,
      actorUserId: actor.member.id,
      workspace: 'project',
    });
  }
}

function assertDateOrder(start: string, end: string, what: string): void {
  if (start > end) {
    throw new BadRequestException(
      `A ${what} can’t be planned to end before it starts.`,
    );
  }
}

function assertTarget(target: number | null, unit: string | null): void {
  if (target !== null && !unit?.trim()) {
    throw new BadRequestException(
      'A target quantity needs its unit, such as “streetlights”.',
    );
  }
  if (target === null && unit) {
    throw new BadRequestException('A unit needs a target quantity.');
  }
}

function assertPayment(isPayment: boolean, amountMinor: string | null): void {
  if (isPayment && !amountMinor) {
    throw new BadRequestException('A payment milestone needs its amount.');
  }
}

function stagePlan(stage: ContractStage): Record<string, unknown> {
  return {
    name: stage.name,
    description: stage.description,
    weightBps: stage.weightBps,
    plannedStartDate: stage.plannedStartDate,
    plannedEndDate: stage.plannedEndDate,
  };
}

function milestonePlan(milestone: Milestone): Record<string, unknown> {
  return {
    title: milestone.title,
    description: milestone.description,
    acceptanceCriteria: milestone.acceptanceCriteria,
    deliverables: milestone.deliverables,
    weightBps: milestone.weightBps,
    targetQuantity: milestone.targetQuantity,
    quantityUnit: milestone.quantityUnit,
    isPaymentMilestone: milestone.isPaymentMilestone,
    amountMinor: milestone.amountMinor,
    plannedStartDate: milestone.plannedStartDate,
    dueDate: milestone.dueDate,
    revisedDueDate: milestone.revisedDueDate,
  };
}

/** Only the fields that changed, before and after; null if nothing did. */
function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changed = Object.keys(after).filter(
    (key) =>
      JSON.stringify(before[key] ?? null) !==
      JSON.stringify(after[key] ?? null),
  );
  if (!changed.length) return null;
  return {
    before: Object.fromEntries(
      changed.map((key) => [key, before[key] ?? null]),
    ),
    after: Object.fromEntries(changed.map((key) => [key, after[key] ?? null])),
  };
}

function decisionSummary(
  milestone: Milestone,
  sequence: number,
  decision: EMilestoneDecisionType,
): string {
  const accepted = `${(milestone.approvedBps / 100).toString()}%`;
  switch (decision) {
    case EMilestoneDecisionType.APPROVED:
      return `Approved submission ${sequence} of milestone ${milestone.title}.`;
    case EMilestoneDecisionType.PARTIALLY_APPROVED:
      return `Partially approved submission ${sequence} of milestone ${milestone.title}; ${accepted} accepted so far.`;
    default:
      return `Rejected submission ${sequence} of milestone ${milestone.title}.`;
  }
}

function spaced(status: string): string {
  return status.replace(/_/g, ' ');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/** A calendar day in the contract's own time zone (approved rule 7). */
function contractDay(contract: Contract, now = new Date()): string {
  return dayInTimeZone(now, contract.timezone);
}
