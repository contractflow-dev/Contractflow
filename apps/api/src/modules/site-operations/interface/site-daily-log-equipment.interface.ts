import { EquipmentCondition } from "../entities/site-daily-log-equipment.entity"

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