import { EHseInspectionStatus, EHseInspectionType, EHseOverallResult } from "@contractflow/contracts-schema"

export interface IHseInspectionEntity {
    contractId : string
    contractSiteId : string
    inspectorCompanyUserId : string
    referenceNumber : string
    inspectionType : EHseInspectionType
    status : EHseInspectionStatus
    scheduledDate : Date
    conductedAt : Date
    externalInspectorFirstName : string
    externalInspectorLastName : string
    externalInspectorOrganization : string
    overallResult : EHseOverallResult
    scoreBps : number
    summary : string
}