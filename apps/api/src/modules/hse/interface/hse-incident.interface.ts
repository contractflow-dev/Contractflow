import { EHseIncidentStatus, EHseIncidentType, EHseSeverity } from "@contractflow/contracts-schema"

export interface IHseIncidentEntity {
    contractId : string
    contractSiteId : string
    referenceNumber : string
    incidentType : EHseIncidentType
    severity : EHseSeverity
    status : EHseIncidentStatus
    occurredAt : Date
    locationDetail : string
    description : string
    immediateActionTaken : string
    rootCause : string
    investigationSummary : string
    lostTimeDays : number
    estimatedCostMinor : number
    currencyCode : string
    isNotifiable : boolean
    authorityNotifiedAt : Date
    reportedAt : Date
    reportedById : string
    investigatedById : string
    closedAt : Date
    closedById : string
}