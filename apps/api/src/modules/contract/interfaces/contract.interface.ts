import { EContractStatus, EContractType } from "@contractflow/contracts-schema"

export interface IContractEntity {
    referenceNumber : string
    title : string
    description : string | null
    contractType : EContractType
    status : EContractStatus
    parentContractId : string | null
    originalValueMinor : string | number
    currentValueMinor : string | number
    currencyCode : string
    retentionRateBps : number
    advancePaymentRateBps : number | null
    paymentTermsDays : number
    liquidatedDamagesPerDayMinor : string | number | null
    awardDate : Date
    startDate : Date
    endDate : Date
    revisedEndDate : Date | null
    actualCompletionDate : Date | null
    defectsLiabilityDays : number
    timezone : string
    createdByCompanyId: string | null
    deletedAt: Date | null
    deletedByCompanyUserId: string | null
}