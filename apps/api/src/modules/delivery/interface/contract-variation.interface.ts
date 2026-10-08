import { EContractVariationStatus, EContractVariationType } from "@contractflow/contracts-schema"

export interface IContractVariationEntity {
    contractId : string
    raisedByPartyId : string
    referenceNumber : string
    title : string
    description : string
    variationType : EContractVariationType
    status : EContractVariationStatus
    amountDeltaMinor : number
    currencyCode : string
    timeExtensionDays : number
    submittedAt : Date
    submittedById : string
    decidedAt : Date
    decidedById : string
    decisionNote : string
}