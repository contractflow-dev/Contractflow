import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Invoice } from "./invoice.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IInvoiceAdjustmentEntity } from "../interface/invoice-adjustment.interface";
import { InvoiceAdjustmentType } from "@contractflow/contracts-schema"


@Entity("invoice_adjustment")
export class InvoiceAdjustment extends BaseCustomEntity implements IInvoiceAdjustmentEntity{

    @Column({name: "invoice_id", type: "varchar", length: 26})
    invoiceId!: string
    @ManyToOne(() => Invoice, {onDelete:"CASCADE"})
    @JoinColumn({name: "invoice_id", referencedColumnName: "id"})
    invoice!: Invoice

    @Column({name: "adjustment_type", type: "enum", enum: InvoiceAdjustmentType})
    adjustmentType!: InvoiceAdjustmentType

    @Column({name: "description", type: "varchar", length: 255})
    description!: string

    @Column({name: "rate_bps", type: "int"})
    rateBps!: number

    @Column({name: "base_amount_minor", type: "bigint"})
    baseAmountMinor!: number

    @Column({name: "amount_minor", type: "bigint"})
    amountMinor!: number

    @Column({name: "currency_code", type: "char", length: 3})
    currencyCode!: string


}