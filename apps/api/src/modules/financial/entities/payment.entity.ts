import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { Invoice } from "./invoice.entity"; 
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IPaymentEntity } from "../interface/payment.interface";
import { EPaymentMethod, EPaymentStatus } from "@contractflow/contracts-schema";


@Entity("payment")
export class Payment extends BaseCustomEntity implements IPaymentEntity {

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name: "contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "invoice_id", type: "varchar", length: 26})
    invoiceId!: string
    @ManyToOne(() => Invoice, {onDelete:"CASCADE"})
    @JoinColumn({name: "invoice_id", referencedColumnName: "id"})
    invoice!: Invoice

    @Column({name: "payment_reference", type: "varchar", length: 40, unique: true})
    paymentReference!: string

    @Column({name: "idempotency_key", type: "varchar", length: 64, unique: true})
    idempotencyKey!: string

    @Column({name: "amount_minor", type: "bigint"})
    amountMinor!: number

    @Column({name: "currency_code", type: "char", length: 3})
    currencyCode!: string

    @Column({name: "invoice_amount_minor", type: "bigint"})
    invoiceAmountMinor!: number

    @Column({name: "invoice_currency_code", type: "char", length: 3})
    invoiceCurrencyCode!: string

    @Column({name: "fx_base_currency_code", type: "char", length: 3})
    fxBaseCurrencyCode!: string

    @Column({name: "fx_rate_micro", type: "bigint"})
    fxRateMicro!: number

    @Column({name: "fx_rate_source", type: "varchar", length: 64})
    fxRateSource!: string

    @Column({name: "fx_rate_at", type: "timestamptz"})
    fxRateAt!: Date

    @Column({name: "payment_method", type: "enum", enum: EPaymentMethod})
    paymentMethod!: EPaymentMethod

    @Column({name: "status", type: "enum", enum: EPaymentStatus})
    status!: EPaymentStatus

    @Column({name: "payment_date", type: "date"})
    paymentDate!: Date

    @Column({name: "external_reference", type: "varchar", length: 100})
    externalReference!: string

    @Column({name: "recorded_at", type: "timestamptz"})
    recordedAt!: Date

    @Column({name: "recorded_by_id", type: "varchar", length: 26})
    recordedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "recorded_by_id", referencedColumnName: "id"})
    recordedBy!: CompanyUser

    @Column({name: "approved_at", type: "timestamptz"})
    approvedAt!: Date

    @Column({name: "approved_by_id", type: "varchar", length: 26})
    approvedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "approved_by_id", referencedColumnName: "id"})
    approvedBy!: CompanyUser

    @Column({name: "receipt_confirmed_at", type: "timestamptz"})
    receiptConfirmedAt!: Date

    @Column({name: "receipt_confirmed_by_id", type: "varchar", length: 26})
    receiptConfirmedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "receipt_confirmed_by_id", referencedColumnName: "id"})
    confirmedBy!: CompanyUser

    @Column({name: "notes", type: "text"})
    notes!: string

}