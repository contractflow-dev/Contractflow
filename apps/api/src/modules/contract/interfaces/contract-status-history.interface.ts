import { EFromStatus, EToStatus } from "@contractflow/contracts-schema"

export interface IContractStatusHistoryEntity {
    contractId : string
    fromStatus : EFromStatus | null
    toStatus : EToStatus
    reason : string | null
    changedById : string
    changedAt : Date
}