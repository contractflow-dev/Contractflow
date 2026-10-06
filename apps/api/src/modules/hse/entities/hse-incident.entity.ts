import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn} from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { ContractSite } from "../../site-operations/entities/contract-site.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IHseIncidentEntity } from "../interface/hse-incident.interface";
import { HseIncidentStatus, HseIncidentType, HseSeverity } from "@contractflow/contracts-schema";



@Entity("hse_incident")
export class HseIncident extends BaseCustomEntity implements IHseIncidentEntity{

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "contract_site_id", type: "varchar", length: 26})
    contractSiteId!: string
    @ManyToOne(() => ContractSite, {onDelete:"CASCADE"})
    @JoinColumn({name:"contract_site_id", referencedColumnName: "id"})
    contractSite!: ContractSite   

    @Column({name: "reference_number", type:"varchar", length:40})
    referenceNumber!: string

    @Column({name: "incident_type", type:"enum", enum: HseIncidentType})
    incidentType!: HseIncidentType

    @Column({name: "severity", type:"enum", enum: HseSeverity})
    severity!: HseSeverity

    @Column({name: "status", type:"enum", enum: HseIncidentStatus})
    status!: HseIncidentStatus

    @Column({name: "occurred_at", type:"timestamptz"})
    occurredAt!: Date

    @Column({name: "location_detail", type:"varchar", length:255})
    locationDetail!: string

    @Column({name: "description", type:"text"})
    description!: string

    @Column({name: "immediate_action_taken", type:"text"})
    immediateActionTaken!: string

    @Column({name: "root_cause", type:"text"})
    rootCause!: string

    @Column({name: "investigation_summary", type:"text"})
    investigationSummary!: string

    @Column({name: "lost_time_days", type:"int"})
    lostTimeDays!: number

    @Column({name: "estimated_cost_minor",type:"bigint"})
    estimatedCostMinor!: number

    @Column({name: "currency_code", type:"char", length:3})
    currencyCode!: string

    @Column({name: "is_notifiable", type:"boolean"})
    isNotifiable!: boolean

    @Column({name: "authority_notified_at", type:"timestamptz"})
    authorityNotifiedAt!: Date

    @Column({name: "reported_at", type:"timestamptz"})
    reportedAt!: Date

    @Column({name: "reported_by_id", type: "varchar", length: 26})
    reportedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"reported_by_id", referencedColumnName: "id"})
    companyUser!: CompanyUser 
 
    @Column({name: "investigated_by_id", type: "varchar", length: 26})
    investigatedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"investigated_by_id", referencedColumnName: "id"})
    investigatedBy!: CompanyUser 
    
    @Column({name: "closed_at", type:"timestamptz"})
    closedAt!: Date

    @Column({name: "closed_by_id", type: "varchar", length: 26})
    closedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"closed_by_id", referencedColumnName: "id"})
    closedBy!: CompanyUser 
}