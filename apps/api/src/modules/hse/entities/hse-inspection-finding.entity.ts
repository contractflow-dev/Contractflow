import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn} from "typeorm";
import { HseInspection } from "./hse-inspection.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IHseInspectionFidingEntity } from "../interface/hse-inspection-finding.interface";
import { HseInpectionResult, HseInpectionRiskLevel } from "@contractflow/contracts-schema";


@Entity("hse_inspection_finding")
export class HseInspectionFinding extends BaseCustomEntity implements IHseInspectionFidingEntity{

    @Column({name: "hse_inspection_id", type: "varchar", length: 26})
    hseInspectionId!: string
    @ManyToOne(() => HseInspection, {onDelete:"CASCADE"})
    @JoinColumn({name:"hse_inspection_id", referencedColumnName: "id"})
    hseInspection!: HseInspectionFinding

    @Column({name: "item_number", type: "int"})
    itemNumber!: number

    @Column({name: "category", type: "varchar", length: 100})
    category!: string

    @Column({name: "description", type:"text"})
    description!: string

    @Column({name: "result", type: "enum", enum: HseInpectionResult})
    result!: HseInpectionResult

    @Column({name: "risk_level", type: "enum", enum: HseInpectionRiskLevel})
    riskLevel!: HseInpectionRiskLevel

    @Column({name: "recommendation", type: "text"})
    recommendation!: string
}