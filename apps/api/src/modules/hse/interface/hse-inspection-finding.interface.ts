import { EHseInspectionResult, EHseInspectionRiskLevel } from "@contractflow/contracts-schema"

export interface IHseInspectionFidingEntity {
    hseInspectionId : string
    itemNumber : number
    category : string
    description : string
    result : EHseInspectionResult
    riskLevel : EHseInspectionRiskLevel
    recommendation : string
}