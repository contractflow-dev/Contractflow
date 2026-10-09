import { EHseActionStatus, EHseCorrectiveActionPriority } from "@contractflow/contracts-schema"

export interface IHseCorrectiveActionEntity {
    contractId : string
    hseIncidentId : string
    hseInspectionFindingId : string
    assignedToCompanyUserId : string
    description : string
    priority : EHseCorrectiveActionPriority
    status : EHseActionStatus
    dueDate : Date
    completedAt : Date
    verifiedAt : Date
    verifiedById : string
    closureNote : string
}