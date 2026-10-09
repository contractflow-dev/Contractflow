import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IContractEntity } from "../interfaces/contract.interface";
import { EContractStatus, EContractType } from "@contractflow/contracts-schema";


@Entity("contract")
export class Contract extends BaseCustomEntity implements IContractEntity {

    @Column({name: "reference_number", type: "varchar", length:40, unique:true})
    referenceNumber!: string

    @Column({name: "title", type: "varchar", length:255})
    title!: string

    @Column({name: "description", type: "text"})
    description!: string

    @Column({name: "contract_type", type:"enum", enum: EContractType})
    contractType!: EContractType

    @Column({name: "status", type:"enum", enum: EContractStatus})
    status!: EContractStatus
    
    @Column({name: "parent_contract_id", type:"varchar", length: 26, nullable:true})
    parentContractId!: string
    @ManyToOne(()=> Contract, {onDelete: "CASCADE"})
    @JoinColumn({name: "parent_contract_id", referencedColumnName: "id"})
    parentContract!: Contract
    
    @Column({name: "original_value_minor", type:"bigint"})
    originalValueMinor!: number

    @Column({name: "current_value_minor", type:"bigint"})
    currentValueMinor!: number

    @Column({name: "currency_code", type:"char", length: 3 })
    currencyCode!: string

    @Column({name: "retention_rate_bps", type:"int"})
    retentionRateBps!: number

    @Column({name: "advance_payment_rate_bps", type:"int"})
    advancePaymentRateBps!: number

    @Column({name: "payment_terms_days", type:"int"})
    paymentTermsDays!: number

    @Column({name: "liquidated_damages_per_day_minor", type:"bigint"})
    liquidatedDamagesPerDayMinor!: number

    @Column({name: "award_date", type:"date"})
    awardDate!: Date

    @Column({name: "start_date", type:"date"})
    startDate!: Date

    @Column({name: "end_date", type:"date"})
    endDate!: Date

    @Column({name: "revised_end_date", type:"date"})
    revisedEndDate!: Date

    @Column({name: "actual_completion_date", type:"date"})
    actualCompletionDate!: Date

    @Column({name: "defects_liability_days", type:"int"})
    defectsLiabilityDays!: number

    @Column({name: "timezone", type:"varchar", length:64})
    timezone!: string

}

