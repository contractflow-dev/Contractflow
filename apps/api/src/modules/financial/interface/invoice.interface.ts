import { EInvoiceStatus, EInvoiceType, ECurrencyCode } from "@contractflow/contracts-schema"

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
    currencyCode : ECurrencyCode
    grossAmountMinor : string
    adjustmentsTotalMinor : string
    netPayableMinor : string
    amountPaidMinor : string
    submittedAt : Date
    submittedById : string
    certifiedAt : Date
    certifiedById : string
    rejectionReason : string
}