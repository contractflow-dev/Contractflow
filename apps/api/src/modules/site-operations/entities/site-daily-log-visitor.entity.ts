import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn} from "typeorm";
import { SiteDailyLog } from "./site-daily-log.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { ISiteDailyLogVisitorEntity } from "../interface/site-daily-log-visitor.interface";


@Entity("site_daily_log_visitor")
export class SiteDailyLogVisitor extends BaseCustomEntity implements ISiteDailyLogVisitorEntity{

    @Column({name: "site_daily_log_id", type: "varchar", length: 26})
    siteDailyLogId!: string
    @ManyToOne(() => SiteDailyLog)
    @JoinColumn({name: "site_daily_log_id", referencedColumnName: "id"})
    siteDailyLog!: SiteDailyLog

    @Column({name: "first_name", type: "varchar", length: 100})
    firstName!: string

    @Column({name: "last_name", type: "varchar", length: 100})
    lastName!: string

    @Column({name: "organization", type: "varchar", length: 255})
    organization!: string

    @Column({name: "purpose", type: "varchar", length: 255})
    purpose!: string

    @Column({name: "time_in", type: "timestamptz"})
    timeIn!: Date

    @Column({name: "time_out", type: "timestamptz"})
    timeOut!: Date
}