import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, OneToOne} from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { HseIncident } from "./hse-incident.entity";
import { HseInspectionFinding } from "./hse-inspection-finding.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IHseCorrectiveActionEntity } from "../interface/hse-corrective-action.interface";
import { EHseCorrectiveActionPriority, EHseActionStatus } from "@contractflow/contracts-schema";


@Entity("hse_corrective_action")
export class HseCorrectiveAction extends BaseCustomEntity implements IHseCorrectiveActionEntity{

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "hse_incident_id", type: "varchar", length: 26})
    hseIncidentId!: string
    @OneToOne(() => HseIncident, {onDelete:"CASCADE"})
    @JoinColumn({name:"hse_incident_id"})
    hseIncident!: HseIncident

    @Column({name: "hse_inspection_finding_id", type: "varchar", length: 26})
    hseInspectionFindingId!: string
    @ManyToOne(() => HseInspectionFinding, {onDelete:"CASCADE"})
    @JoinColumn({name:"hse_inspection_finding_id", referencedColumnName: "id"})
    hseInspectionFinding!: HseInspectionFinding

    @Column({name: "assigned_to_company_user_id", type: "varchar", length: 26})
    assignedToCompanyUserId!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"assigned_to_company_user_id", referencedColumnName: "id"})
    companyUser!: CompanyUser

    @Column({name: "description", type:"text"})
    description!: string

    @Column({name: "priority", type:"enum", enum: EHseCorrectiveActionPriority})
    priority!: EHseCorrectiveActionPriority  

    @Column({name: "status", type:"enum", enum: EHseActionStatus})
    status!: EHseActionStatus

    @Column({name: "due_date", type:"date"})
    dueDate!: Date

    @Column({name: "completed_at", type:"timestamptz"})
    completedAt!: Date

    @Column({name: "verified_at", type:"timestamptz"})
    verifiedAt!: Date

    @Column({name: "verified_by_id", type: "varchar", length: 26})
    verifiedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"verified_by_id", referencedColumnName: "id"})
    verifiedCompanyUser!: CompanyUser

    @Column({name: "closure_note", type:"text"})
    closureNote!: string
    
}