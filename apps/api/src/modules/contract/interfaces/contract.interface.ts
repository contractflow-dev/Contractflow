import { ContractStatus, ContractType } from "@contractflow/contracts-schema"

export interface IContractEntity {
    referenceNumber : string
    title : string
    description : string
    contractType : ContractType
    status : ContractStatus
    parentContractId : string
    originalValueMinor : Number
    currentValueMinor : number
    currencyCode : string
    retentionRateBps : number
    advancePaymentRateBps : number
    paymentTermsDays : number
    liquidatedDamagesPerDayMinor : number
    awardDate : Date
    startDate : Date
    endDate : Date
    revisedEndDate : Date
    actualCompletionDate : Date
    defectsLiabilityDays : number
    timezone : string
}