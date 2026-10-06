import { FromStatus, ToStatus } from "@contractflow/contracts-schema"

export interface IContractStatusHistoryEntity {
    contractId : string
    fromStatus : FromStatus
    toStatus : ToStatus
    reason : string
    changedById : string
    changedAt : Date
}