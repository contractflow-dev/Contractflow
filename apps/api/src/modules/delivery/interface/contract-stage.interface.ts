import { Status } from "../entities/contract-stage.entity"

export interface IContractStageEntity {
    contractId : string
    name : string
    description : string
    sequence : string
    status : Status
    weightBps : number
    plannedStartDate : Date
    plannedEndDate : Date
    actualStartDate : Date
    actualEndDate : Date
}