export enum EStatus{
    PLANNED = 'planned',
    ACTIVE = 'active',
    IN_PROGRESS = 'in_progress',
    PENDING_APPROVAL = 'pending_approval',
    COMPLETED = 'completed',
    DELAYED = 'delayed',
    CANCELLED = 'cancelled'
}
export enum EContractVariationType{
    SCOPE_CHANGE = 'scope_change',
    TIME_EXTENSION = 'time_extension',
    COST_ADJUSTMENT = 'cost_adjustment',
    PRICE_REVISON = 'price_revision',
    SCHEDULE_CHANGE = 'schedule_change',
    DESIGN_CHANGE = 'design_change',
    TECHNICAL_CHANGE = 'technical_change',
    PROCUREMENT_CHANGE = 'procurement_change',
    MATERIAL_CHANGE = 'material_change',
    REGULATORY_CHANGE = 'regulatory_change',
    OTHER = 'other'
}

export enum EContractVariationStatus{
    DRAFT = 'draft',
    SUBMITTED = 'submitted',
    UNDER_REVIEW = 'under_review',
    PENDING_APPROVAL = 'pending_approval',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    NEGOTIATING = 'negotiating',
    IMPLEMENTED = 'implemented',
    CANCELLED = 'cancelled',
    WITHDRAWN = 'withdrawn'
}
export enum EMilestoneStatus{
    PLANNED = 'planned',
    ACTIVE = 'active',
    IN_PROGRESS = 'in_progress',
    PENDING_APPROVAL = 'pending_approval',
    APPROVED = 'approved',
    COMPLETED = 'completed',
    DELAYED = 'delayed',
    AT_RISK = 'at_risk',
    ON_HOLD = 'on_hold',
    CANCELLED = 'cancelled'
}