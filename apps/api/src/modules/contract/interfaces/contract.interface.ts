import { FromStatus, ToStatus } from "../entities/contract-status-history.entity"
import { ContractStatus, ContractType, CurrencyType } from "../entities/contract.entity"

export interface IContractEntity {
    referenceNumber : string
    title : string
    description : string
    contractType : ContractType
    status : ContractStatus
    parentContractId : string
    originalValueMinor : Number
    currentValueMinor : number
    currencyCode : CurrencyType
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