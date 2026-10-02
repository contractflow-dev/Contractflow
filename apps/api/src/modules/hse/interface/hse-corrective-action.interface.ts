import { HseActionStatus, HseCorrectiveActionPriority } from "../entities/hse-corrective-action.entity"

export interface IHseCorrectiveActionEntity {
    contractId : string
    hseIncidentId : string
    hseInspectionFindingId : string
    assignedToCompanyUserId : string
    description : string
    priority : HseCorrectiveActionPriority
    status : HseActionStatus
    dueDate : Date
    completedAt : Date
    verifiedAt : Date
    verifiedById : string
    closureNote : string
}