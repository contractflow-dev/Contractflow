import type {
  DateOnlyString,
  TimestampString,
} from "../../../common/interfaces/workspace-values.interface.js";
import type { MinorAmount } from "../../../common/money/minor-amount.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";
import type {
  EContractVariationStatus,
  EContractVariationType,
  EMilestoneDecisionType,
  EMilestoneOutstandingItemStatus,
  EMilestoneStatus,
  EMilestoneSubmissionType,
  ELifecycleStageCode,
  EStatus,
} from "../enums/delivery.enum.js";

/** `GET /contract/stages`, Project workspace. */
export interface ContractStage {
  id: string;
  contractId: string;
  /** The lifecycle stage it was copied from; null for a custom or older stage. */
  stageCode: ELifecycleStageCode | null;
  name: string;
  description: string | null;
  sequence: number;
  status: EStatus;
  /**
   * Whether the stage applies to this contract. A stage that doesn't apply
   * keeps its record but counts for nothing in progress.
   */
  isApplicable: boolean;
  /** Why the stage doesn't apply; null while it applies. */
  applicabilityReason: string | null;
  /** Share of the contract, in basis points (10,000 = 100%). */
  weightBps: number;
  /**
   * Client-approved progress of the stage, in basis points: each milestone's
   * approved share weighted by its share of the stage. Derived, not stored.
   */
  progressBps: number;
  plannedStartDate: DateOnlyString;
  plannedEndDate: DateOnlyString;
  actualStartDate: DateOnlyString | null;
  actualEndDate: DateOnlyString | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/milestones`, Project workspace. */
export interface Milestone {
  id: string;
  contractId: string;
  contractStageId: string;
  title: string;
  description: string | null;
  /** What the client will check before accepting the milestone. */
  acceptanceCriteria: string | null;
  /** The expected deliverables. */
  deliverables: string | null;
  sequence: number;
  status: EMilestoneStatus;
  /** Completion the contractor reported with its latest submission (bps). */
  progressBps: number;
  /** Share of the milestone the client has accepted so far (bps). */
  approvedBps: number;
  weightBps: number;
  /** A measurable target, such as 100 (streetlights); null if none. */
  targetQuantity: number | null;
  quantityUnit: string | null;
  /** Of `targetQuantity`, how much the client has accepted so far. */
  approvedQuantity: number | null;
  isPaymentMilestone: boolean;
  /**
   * The amount agreed for the milestone. Approval never invoices or pays it:
   * payment follows the separate finance workflow.
   */
  amountMinor: MinorAmount | null;
  currencyCode: ECurrencyCode | null;
  plannedStartDate: DateOnlyString | null;
  actualStartDate: DateOnlyString | null;
  dueDate: DateOnlyString;
  revisedDueDate: DateOnlyString | null;
  /** The day it was fully approved. */
  completedDate: DateOnlyString | null;
  /**
   * Not approved, and past its revised (or original) due date, judged by
   * today in the contract's time zone (UTC if that zone is invalid).
   */
  isOverdue: boolean;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  approvedAt: TimestampString | null;
  approvedById: string | null;
  rejectionReason: string | null;
  /**
   * The status the milestone had before the legacy transition moved it into
   * the workflow (such as `at_risk`); null for every other milestone.
   */
  legacyStatus: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `GET /contract/variations`, Project workspace. */
export interface ContractVariation {
  id: string;
  contractId: string;
  raisedByPartyId: string;
  referenceNumber: string;
  title: string;
  description: string;
  variationType: EContractVariationType;
  status: EContractVariationStatus;
  /** Change to the contract value; negative for a reduction. */
  amountDeltaMinor: MinorAmount;
  currencyCode: ECurrencyCode;
  timeExtensionDays: number;
  submittedAt: TimestampString | null;
  submittedById: string | null;
  decidedAt: TimestampString | null;
  decidedById: string | null;
  decisionNote: string | null;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

/** `POST /contract/stages`: Client Project Manager. */
export interface CreateContractStageRequest {
  name: string;
  description?: string | null;
  /** Share of the contract, 0 to 10,000 bps; the stages' total can't exceed 10,000. */
  weightBps: number;
  plannedStartDate: DateOnlyString;
  plannedEndDate: DateOnlyString;
}

/** `PATCH /contract/stages/:stageId`: any subset of the planning fields. */
export type UpdateContractStageRequest = Partial<CreateContractStageRequest> & {
  /**
   * Required when the new planned dates would leave any of the stage's
   * milestones outside them; recorded on the activity entry.
   */
  dateOverrideReason?: string | null;
};

/**
 * `POST /contract/stages/:stageId/transitions`. Allowed: planned to in
 * progress, in progress to on hold and back, in progress to completed (once
 * every milestone of the stage is approved).
 */
export interface TransitionContractStageRequest {
  status:
    | EStatus.IN_PROGRESS
    | EStatus.ON_HOLD
    | EStatus.COMPLETED
    | EStatus.CANCELLED;
  /** Required when putting a stage on hold, resuming it or cancelling it. */
  reason?: string | null;
  /** The actual start or end day; defaults to today in the contract's time zone. */
  effectiveDate?: DateOnlyString | null;
}

/**
 * `POST /contract/stages/:stageId/applicability`: Client Project Manager.
 * A planned stage with no milestones may be marked as not applying (a
 * reason is required) and reinstated while it is still planned.
 */
export interface SetContractStageApplicabilityRequest {
  isApplicable: boolean;
  reason?: string | null;
}

/**
 * `GET /contract/progress`, Project workspace: the contract's lifecycle
 * progress, calculated by the API. Stages that don't apply or were
 * cancelled are left out, and the rest are weighted against their own
 * total, so the figure still reaches 10,000 when every counted stage is
 * done. A completed stage counts in full.
 */
export interface ContractProgress {
  lifecycleProgressBps: number;
  /** The total weight of the counted stages. */
  countedWeightBps: number;
  stages: Array<{
    stageId: string;
    weightBps: number;
    progressBps: number;
    counted: boolean;
  }>;
}

/** `POST /contract/stages/:stageId/milestones`: Client Project Manager. */
export interface CreateMilestoneRequest {
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  deliverables?: string | null;
  /** Share of its stage, 0 to 10,000 bps; a stage's milestones can't exceed 10,000. */
  weightBps: number;
  plannedStartDate?: DateOnlyString | null;
  dueDate: DateOnlyString;
  /** A measurable target, such as 100 for "100 streetlights". */
  targetQuantity?: number | null;
  quantityUnit?: string | null;
  isPaymentMilestone: boolean;
  /** In the contract's currency; required for a payment milestone. */
  amountMinor?: MinorAmount | null;
  /**
   * Required when the planned start or due date falls outside the stage's
   * planned dates; recorded on the activity entry.
   */
  dateOverrideReason?: string | null;
}

/**
 * `PATCH /contract/milestones/:milestoneId`. Scope fields (title, description,
 * criteria, deliverables, target, weight, payment) can change until the first
 * submission; dates until the milestone is approved.
 */
export type UpdateMilestoneRequest = Partial<CreateMilestoneRequest> & {
  revisedDueDate?: DateOnlyString | null;
};

/** One evidence file of a submission: a contract document the contractor shared. */
export interface MilestoneEvidenceReference {
  documentId: string;
  caption?: string | null;
}

/**
 * `POST /contract/milestones/:milestoneId/submissions`: Contractor Project Lead.
 * After a partial approval the submission must name every open outstanding
 * item (`outstandingItemIds`) and covers only those; otherwise it covers the
 * whole milestone and names none.
 */
export interface SubmitMilestoneRequest {
  notes: string;
  /** The contractor's own measure of completion, 0 to 10,000 bps. */
  reportedProgressBps?: number | null;
  /** At least one file; the current version of each is kept with the submission. */
  evidence: MilestoneEvidenceReference[];
  outstandingItemIds?: string[];
}

/** One outstanding work item raised by a partial approval. */
export interface MilestoneOutstandingItemInput {
  description: string;
  /** In the milestone's unit; required when the milestone has a target quantity. */
  quantity?: number | null;
}

/**
 * `POST /contract/milestones/:milestoneId/submissions/:submissionId/decision`:
 * Client Project Manager, once per submission.
 *
 * - `approved`: accepts everything the submission covers and completes the
 *   milestone.
 * - `partially_approved`: `reason`, `approvedWork` and `approvedBps` (this
 *   decision's share of the whole milestone) are required. On a whole-milestone
 *   submission it raises `outstandingItems` (at least one); on an
 *   outstanding-work submission it accepts `acceptedItemIds` (some, not all,
 *   of the items it covers) and the rest stay outstanding.
 * - `rejected`: `reason` is required; nothing is accepted.
 */
export interface DecideMilestoneSubmissionRequest {
  decision: EMilestoneDecisionType;
  reason?: string | null;
  approvedBps?: number | null;
  approvedWork?: string | null;
  /** Required for a partial approval when the milestone has a target quantity. */
  approvedQuantity?: number | null;
  outstandingItems?: MilestoneOutstandingItemInput[];
  acceptedItemIds?: string[];
}

/** A file kept with a submission, at the version it had when submitted. */
export interface MilestoneEvidence {
  id: string;
  documentId: string;
  documentVersionId: string;
  title: string;
  fileName: string;
  versionNumber: number;
  caption: string | null;
}

/** The decision on one submission. Immutable once made. */
export interface MilestoneDecision {
  id: string;
  milestoneId: string;
  submissionId: string;
  decision: EMilestoneDecisionType;
  reason: string | null;
  /** This decision's share of the whole milestone (bps). */
  approvedBps: number;
  /** The milestone's accepted share after this decision (bps). */
  cumulativeApprovedBps: number;
  approvedWork: string | null;
  approvedQuantity: number | null;
  /** The decision-maker's company membership. */
  decidedById: string;
  decidedAt: TimestampString;
  /** Outstanding items this decision raised. */
  raisedItemIds: string[];
  /** Outstanding items this decision accepted. */
  acceptedItemIds: string[];
}

/** One submission, with its evidence and, once made, its decision. Immutable. */
export interface MilestoneSubmission {
  id: string;
  milestoneId: string;
  /** 1 for the first submission, then 2, 3, ... */
  sequence: number;
  submissionType: EMilestoneSubmissionType;
  /** The decision this submission answers (a rejection or partial approval). */
  previousDecisionId: string | null;
  /** The contractor's company membership. */
  submittedById: string;
  submittedAt: TimestampString;
  notes: string;
  reportedProgressBps: number | null;
  evidence: MilestoneEvidence[];
  /** For outstanding-work submissions, the items it covers. */
  addressedItemIds: string[];
  decision: MilestoneDecision | null;
}

/** An outstanding work item and where it stands. */
export interface MilestoneOutstandingItem {
  id: string;
  milestoneId: string;
  description: string;
  quantity: number | null;
  status: EMilestoneOutstandingItemStatus;
  /** The partial approval that raised it. */
  raisedByDecisionId: string;
  /** The decision that accepted it; null while outstanding. */
  acceptedByDecisionId: string | null;
  acceptedAt: TimestampString | null;
  /** Submissions that covered it, oldest first. */
  addressedBySubmissionIds: string[];
  createdAt: TimestampString;
}

/**
 * Query of `GET /contract/milestones` beside `page` and `limit`. Each filter
 * narrows the contract's milestones.
 */
export interface ListMilestonesFilters {
  contractStageId?: string;
  status?: EMilestoneStatus;
  /** Only milestones waiting for the client's decision. */
  pendingReview?: boolean;
  overdue?: boolean;
  /** Effective due date (revised, else original) on or after this day. */
  dueFrom?: DateOnlyString;
  /** Effective due date on or before this day. */
  dueTo?: DateOnlyString;
  /**
   * Milestones with at least one submission at or after this point, from the
   * submission history (not the milestone's own dates). A calendar day
   * (`2026-11-10`) starts at its first UTC millisecond; an instant must name
   * its time zone (`2026-11-10T08:30:00+01:00`).
   */
  submittedFrom?: string;
  /**
   * Milestones with at least one submission at or before this point. A
   * calendar day ends at its last UTC millisecond. With `submittedFrom`, the
   * same submission must fall within both.
   */
  submittedTo?: string;
}
