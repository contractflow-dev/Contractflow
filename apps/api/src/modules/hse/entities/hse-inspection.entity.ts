import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, OneToMany, JoinColumn} from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { ContractSite } from "../../site-operations/entities/contract-site.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IHseInspectionEntity } from "../interface/hse-inspection.interface";
import { EHseInspectionStatus, EHseInspectionType, EHseOverallResult } from "@contractflow/contracts-schema";



@Entity("hse_inspection")
export class HseInspection extends BaseCustomEntity implements IHseInspectionEntity{

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
    
    @Column({name: "inspector_company_user_id", type: "varchar", length: 26})
    inspectorCompanyUserId!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name:"company_id", referencedColumnName: "id"})
    CompanyUser!: CompanyUser

    @Column({name: "reference_number", type:"varchar", length:40})
    referenceNumber!: string

    @Column({name: "inspection_type", type:"enum", enum: EHseInspectionType})
    inspectionType!: EHseInspectionType

    @Column({name: "status", type:"enum", enum: EHseInspectionStatus})
    status!: EHseInspectionStatus

    @Column({name: "scheduled_date", type:"date"})
    scheduledDate!: Date

    @Column({name: "conducted_at", type:"timestamptz"})
    conductedAt!: Date

    @Column({name: "external_inspector_first_name", type:"varchar", length:100})
    externalInspectorFirstName!: string

    @Column({name: "external_inspector_last_name", type:"varchar", length:100})
    externalInspectorLastName!: string

    @Column({name: "external_inspector_organization", type:"varchar", length:255})
    externalInspectorOrganization!: string

    @Column({name: "overall_result", type:"enum", enum: EHseOverallResult})
    overallResult!: EHseOverallResult

    @Column({name: "score_bps", type:"int"})
    scoreBps!: number

    @Column({name: "summary", type:"text"})
    summary!: string

}