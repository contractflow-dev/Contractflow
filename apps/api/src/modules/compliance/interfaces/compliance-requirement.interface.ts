import { AppliesToParty, ComplianceCategory, ComplianceFrequency } from "../entities/compliance-requirement.entity"

export interface IComplianceRequirementEntity {
    contractId : string
    name : string
    description : string
    category : ComplianceCategory
    appliesToPartyType : AppliesToParty
    isMandatory : boolean
    frequency : ComplianceFrequency
    firstDueDate : Date
}