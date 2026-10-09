import { EStatus } from "@contractflow/contracts-schema"

export interface IContractStageEntity {
    contractId : string
    name : string
    description : string
    sequence : string
    status : EStatus
    weightBps : number
    plannedStartDate : Date
    plannedEndDate : Date
    actualStartDate : Date
    actualEndDate : Date
}