import { EInvoiceStatus, EInvoiceType } from "@contractflow/contracts-schema"

export interface IInvoiceEntity {
    contractId : string
    issuedByPartyId : string
    billedToPartyId : string
    invoiceNumber : string
    invoiceType : EInvoiceType
    status : EInvoiceStatus
    issueDate : Date
    dueDate : Date
    periodStart : Date
    periodEnd : Date
    currencyCode : string
    grossAmountMinor : number
    adjustmentsTotalMinor : number
    netPayableMinor : number
    amountPaidMinor : number
    submittedAt : Date
    submittedById : string
    certifiedAt : Date
    certifiedById : string
    rejectionReason : string
}