/**
 * The stages of the standard oil and gas contract lifecycle, in order. A
 * contract created from the lifecycle template gets one stage of each;
 * custom stages and stages of older contracts have no code.
 */
export enum ELifecycleStageCode {
  CONTRACT_AWARD = "contract_award",
  MOBILISATION = "mobilisation",
  CONTRACT_EXECUTION = "contract_execution",
  PERFORMANCE_MONITORING = "performance_monitoring",
  CHANGE_MANAGEMENT = "change_management",
  INSPECTION_ACCEPTANCE = "inspection_acceptance",
  COMMERCIAL_RECONCILIATION = "commercial_reconciliation",
  CONTRACT_CLOSEOUT = "contract_closeout",
  POST_CONTRACT_OBLIGATIONS = "post_contract_obligations",
}

/** What a stage history entry records. */
export enum EStageHistoryEvent {
  INITIALISED = "initialised",
  STATUS_CHANGED = "status_changed",
  APPLICABILITY_CHANGED = "applicability_changed",
  WEIGHT_CHANGED = "weight_changed",
  DATES_CHANGED = "dates_changed",
}

export enum EStatus {
  PLANNED = "planned",
  ACTIVE = "active",
  IN_PROGRESS = "in_progress",
  PENDING_APPROVAL = "pending_approval",
  COMPLETED = "completed",
  DELAYED = "delayed",
  CANCELLED = "cancelled",
  /** Paused by the Client Project Manager; resumes to in progress. */
  ON_HOLD = "on_hold",
}
export enum EContractVariationType {
  SCOPE_CHANGE = "scope_change",
  TIME_EXTENSION = "time_extension",
  COST_ADJUSTMENT = "cost_adjustment",
  PRICE_REVISON = "price_revision",
  SCHEDULE_CHANGE = "schedule_change",
  DESIGN_CHANGE = "design_change",
  TECHNICAL_CHANGE = "technical_change",
  PROCUREMENT_CHANGE = "procurement_change",
  MATERIAL_CHANGE = "material_change",
  REGULATORY_CHANGE = "regulatory_change",
  OTHER = "other",
}

export enum EContractVariationStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  UNDER_REVIEW = "under_review",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  NEGOTIATING = "negotiating",
  IMPLEMENTED = "implemented",
  CANCELLED = "cancelled",
  WITHDRAWN = "withdrawn",
}
export enum EMilestoneStatus {
  PLANNED = "planned",
  ACTIVE = "active",
  IN_PROGRESS = "in_progress",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  COMPLETED = "completed",
  DELAYED = "delayed",
  AT_RISK = "at_risk",
  ON_HOLD = "on_hold",
  CANCELLED = "cancelled",
  /** Some work accepted; the outstanding items are open for resubmission. */
  PARTIALLY_APPROVED = "partially_approved",
  /** The latest submission was rejected; the contractor resubmits. */
  REJECTED = "rejected",
}

/** How a milestone submission relates to what came before it. */
export enum EMilestoneSubmissionType {
  /** The first submission of the whole milestone. */
  INITIAL = "initial",
  /** The whole milestone again, after its submission was rejected. */
  RESUBMISSION = "resubmission",
  /** Only the open outstanding items left by a partial approval. */
  OUTSTANDING_WORK = "outstanding_work",
}

/** The Client Project Manager's decision on one submission. */
export enum EMilestoneDecisionType {
  APPROVED = "approved",
  PARTIALLY_APPROVED = "partially_approved",
  REJECTED = "rejected",
}

/** An outstanding work item: open until a decision accepts it. */
export enum EMilestoneOutstandingItemStatus {
  OUTSTANDING = "outstanding",
  ACCEPTED = "accepted",
}
