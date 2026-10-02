import { HseInpectionResult, HseInpectionRiskLevel } from "../entities/hse-inspection-finding.entity"

export interface IHseInspectionFidingEntity {
    hseInspectionId : string
    itemNumber : number
    category : string
    description : string
    result : HseInpectionResult
    riskLevel : HseInpectionRiskLevel
    recommendation : string
}