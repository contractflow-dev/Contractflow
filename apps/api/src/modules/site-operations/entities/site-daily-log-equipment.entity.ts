import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn} from "typeorm";
import { SiteDailyLog } from "./site-daily-log.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { ISiteDailyLogEquipmentEntity } from "../interface/site-daily-log-equipment.interface";
import { EEquipmentCondition } from "@contractflow/contracts-schema";



@Entity("site_daily_log_equipment")
export class SiteDailyLogEquipment extends BaseCustomEntity implements ISiteDailyLogEquipmentEntity{

    @Column({name: "site_daily_log_id", type: "varchar", length: 26})
    siteDailyLogId!: string
    @ManyToOne(() => SiteDailyLog)
    @JoinColumn({name: "site_daily_log_id", referencedColumnName: "id"})
    siteDailyLog!: SiteDailyLog

    @Column({name: "equipment_name", type: "varchar", length: 150})
    equipmentName!: string

    @Column({name: "equipment_tag", type: "varchar", length: 60})
    equipmentTag!: string

    @Column({name: "quantity", type: "int"})
    quantity!: number

    @Column({name: "minutes_operated", type: "int"})
    minutesOperated!: number

    @Column({name: "minutes_idle", type: "int"})
    minutesIdle!: number

    @Column({name: "condition", type: "enum", enum: EEquipmentCondition})
    condition!: EEquipmentCondition

    @Column({name: "remarks", type: "text"})
    remarks!: string
}