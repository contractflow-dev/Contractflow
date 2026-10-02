import { MilestoneStatus } from "../entities/milestone.entity"

export interface IMilestoneEntity {
    contractId : string
    contractStageId : string
    title : string
    description : string    
    sequence : number
    status : MilestoneStatus
    progressBps : number
    weightBps : number
    isPaymentMilestone : boolean
    amountMinor : number
    currencyCode : string
    dueDate : Date
    revisedDueDate : Date
    completedDate : Date
    submittedAt : Date
    submittedById : string
    approvedAt : Date
    approvedById : string
    rejectionReason : string
}