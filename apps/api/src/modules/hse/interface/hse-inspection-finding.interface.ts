import { EHseInpectionResult, EHseInpectionRiskLevel } from "@contractflow/contracts-schema"

export interface IHseInspectionFidingEntity {
    hseInspectionId : string
    itemNumber : number
    category : string
    description : string
    result : EHseInpectionResult
    riskLevel : EHseInpectionRiskLevel
    recommendation : string
}