import { ComplianceRecordStatus } from "@contractflow/contracts-schema"

export interface IComplianceRecordEntity {
    contractId : string
    complianceRequirementId : string
    contractPartyId : string
    referenceNumber : string
    issuingAuthority : string
    issueDate : Date
    expiryDate : Date
    coveredAmountMinor : number
    currencyCode : string
    status : ComplianceRecordStatus
    verifiedAt : Date
    verifiedById : string
    remarks : string
}