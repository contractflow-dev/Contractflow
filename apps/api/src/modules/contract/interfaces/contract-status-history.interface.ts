import { FromStatus, ToStatus } from "../entities/contract-status-history.entity"

export interface IContractStatusHistoryEntity {
    contractId : string
    fromStatus : FromStatus
    toStatus : ToStatus
    reason : string
    changedById : string
    changedAt : Date
}