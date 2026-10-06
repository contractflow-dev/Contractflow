import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Contract } from "../../contract/entities/contract.entity";
import { ContractParty } from "../../contract/entities/contract-party.entity";
import { CompanyUser } from "../../identity/entities/company-user.entity";
import { BaseCustomEntity } from "../../cross-cutting/entities/base-custom.entity";
import { IInvoiceEntity } from "../interface/invoice.interface";
import { InvoiceStatus, InvoiceType } from "@contractflow/contracts-schema";



@Entity("invoice")
export class Invoice extends BaseCustomEntity implements IInvoiceEntity{

    @Column({name: "contract_id", type: "varchar", length: 26})
    contractId!: string
    @ManyToOne(() => Contract, {onDelete:"CASCADE"})
    @JoinColumn({name: "contract_id", referencedColumnName: "id"})
    contract!: Contract

    @Column({name: "issued_by_party_id", type: "varchar", length: 26})
    issuedByPartyId!: string
    @ManyToOne(() => ContractParty, {onDelete:"CASCADE"})
    @JoinColumn({name: "issued_by_party_id", referencedColumnName: "id"})
    issuedByContractParty!: ContractParty

    @Column({name: "billed_to_party_id", type: "varchar", length: 26})
    billedToPartyId!: string
    @ManyToOne(() => ContractParty, {onDelete:"CASCADE"})
    @JoinColumn({name: "billed_by_party_id", referencedColumnName: "id"})
    billedToContractParty!: ContractParty

    @Column({name: "invoice_number", type: "varchar", length: 40})
    invoiceNumber!: string

    @Column({name: "invoice_type", type: "enum", enum: InvoiceType})
    invoiceType!: InvoiceType

    @Column({name: "status", type: "enum", enum: InvoiceStatus})
    status!: InvoiceStatus

    @Column({name: "issue_date", type: "date"})
    issueDate!: Date

    @Column({name: "due_date", type: "date"})
    dueDate!: Date

    @Column({name: "period_start", type: "date"})
    periodStart!: Date

    @Column({name: "period_end", type: "date"})
    periodEnd!: Date

    @Column({name: "currency_code", type: "char", length: 3})
    currencyCode!: string

    @Column({name: "gross_amount_minor", type: "bigint"})
    grossAmountMinor!: number

    @Column({name: "adjustments_total_minor", type: "bigint"})
    adjustmentsTotalMinor!: number

    @Column({name: "net_payable_minor", type: "bigint"})
    netPayableMinor!: number

    @Column({name: "amount_paid_minor", type: "bigint"})
    amountPaidMinor!: number

    @Column({name: "submitted_at", type: "timestamptz"})
    submittedAt!: Date

    @Column({name: "submitted_by_id", type: "varchar", length: 26})
    submittedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "submitted_by_id", referencedColumnName: "id"})
    submittedBy!: CompanyUser

    @Column({name: "certified_at", type: "timestamptz"})
    certifiedAt!: Date    

    @Column({name: "certified_by_id", type: "varchar", length: 26})
    certifiedById!: string
    @ManyToOne(() => CompanyUser, {onDelete:"CASCADE"})
    @JoinColumn({name: "certified_by_id", referencedColumnName: "id"})
    certifiedBy!: CompanyUser

    @Column({name: "rejection_reason", type: "text"})
    rejectionReason!: string  

}