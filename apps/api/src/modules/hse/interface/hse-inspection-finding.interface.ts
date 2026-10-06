import { HseInpectionResult, HseInpectionRiskLevel } from "@contractflow/contracts-schema"

export interface IHseInspectionFidingEntity {
    hseInspectionId : string
    itemNumber : number
    category : string
    description : string
    result : HseInpectionResult
    riskLevel : HseInpectionRiskLevel
    recommendation : string
}