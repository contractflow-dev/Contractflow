import { EFromStatus, EToStatus } from "@contractflow/contracts-schema"

export interface IContractStatusHistoryEntity {
    contractId : string
    fromStatus : EFromStatus
    toStatus : EToStatus
    reason : string
    changedById : string
    changedAt : Date
}