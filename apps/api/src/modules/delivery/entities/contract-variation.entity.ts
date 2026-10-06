import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { ContractParty } from "../../contract/entities/contract-party.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IContractVariationEntity } from "../interface/contract-variation.interface";
import { ContractVariationType, ContractVariationStatus } from "@contractflow/contracts-schema";



@Entity("contract_variation")
export class ContractVariation extends BaseCustomEntity implements IContractVariationEntity {

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name: "contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "raised_by_party_id", type: "varchar", length: 26})
    raisedByPartyId!: string
    @ManyToOne(() => ContractParty, {onDelete:"CASCADE"})
    @JoinColumn({name: "raised_by_party_id", referencedColumnName: "id"})
    raisedByParty!: ContractParty

    @Column({name: "reference_number", type: "varchar", length: 40})
    referenceNumber!: string

    @Column({name: "title", type: "varchar", length: 255})
    title!: string

    @Column({name: "description", type: "text"})
    description!: string

    @Column({name: "variation_type", type: "enum", enum: ContractVariationType})
    variationType!: ContractVariationType

    @Column({name: "status", type: "enum", enum: ContractVariationStatus})
    status!: ContractVariationStatus

    @Column({name: "amount_delta_minor", type: "bigint"})
    amountDeltaMinor!: number

    @Column({name: "currency_code", type: "char", length: 3})
    currencyCode!: string

    @Column({name: "time_extension_days", type: "int"})
    timeExtensionDays!: number

    @Column({name: "submitted_at", type: "timestamptz"})
    submittedAt!: Date

    @Column({name: "submitted_by_id", type: "varchar", length: 26})
    submittedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "submitted_by_id", referencedColumnName: "id"})
    submittedBy!: CompanyUser

    @Column({name: "decided_at", type: "timestamptz"})
    decidedAt!: Date

    @Column({name: "decided_by_id", type: "varchar", length: 26})
    decidedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "decided_by_id", referencedColumnName: "id"})
    decidedBy!: CompanyUser

    @Column({name: "decision_note", type: "text"})
    decisionNote!: string 

 
}