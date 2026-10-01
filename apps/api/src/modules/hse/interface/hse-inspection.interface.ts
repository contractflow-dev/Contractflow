import { HseInspectionStatus, HseInspectionType, HseOverallResult } from "../entities/hse-inspection.entity"

export interface IHseInspectionEntity {
    contractId : string
    contractSiteId : string
    inspectorCompanyUserId : string
    referenceNumber : string
    inspectionType : HseInspectionType
    status : HseInspectionStatus
    scheduledDate : Date
    conductedAt : Date
    externalInspectorFirstName : string
    externalInspectorLastName : string
    externalInspectorOrganization : string
    overallResult : HseOverallResult
    scoreBps : number
    summary : string
}