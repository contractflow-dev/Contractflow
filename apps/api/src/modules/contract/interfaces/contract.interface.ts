import { EContractStatus, EContractType } from "@contractflow/contracts-schema"

export interface IContractEntity {
    referenceNumber : string
    title : string
    description : string
    contractType : EContractType
    status : EContractStatus
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