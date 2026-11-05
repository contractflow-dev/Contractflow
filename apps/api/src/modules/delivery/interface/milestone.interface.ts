import { EMilestoneStatus, ECurrencyCode } from "@contractflow/contracts-schema"
export interface IMilestoneEntity {
    contractId : string
    contractStageId : string
    title : string
    description : string    
    sequence : number
    status : EMilestoneStatus
    progressBps : number
    weightBps : number
    isPaymentMilestone : boolean
    amountMinor : number
    currencyCode : ECurrencyCode
    dueDate : Date
    revisedDueDate : Date
    completedDate : Date
    submittedAt : Date
    submittedById : string
    approvedAt : Date
    approvedById : string
    rejectionReason : string
}