import { EquipmentCondition } from "@contractflow/contracts-schema"

export interface ISiteDailyLogEquipmentEntity {
    siteDailyLogId : string
    equipmentName : string
    equipmentTag : string
    quantity : number
    minutesOperated : number
    minutesIdle : number
    condition   : EquipmentCondition
    remarks : string
}