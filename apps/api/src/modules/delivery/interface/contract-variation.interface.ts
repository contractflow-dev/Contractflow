import { ContractVariationStatus, ContractVariationType } from "../entities/contract-variation.entity"

export interface IContractVariationEntity {
    contractId : string
    raisedByPartyId : string
    referenceNumber : string
    title : string
    description : string
    variationType : ContractVariationType
    status : ContractVariationStatus
    amountDeltaMinor : number
    currencyCode : string
    timeExtensionDays : number
    submittedAt : Date
    submittedById : string
    decidedAt : Date
    decidedById : string
    decisionNote : string
}