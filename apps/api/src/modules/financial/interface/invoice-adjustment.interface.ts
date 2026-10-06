import { InvoiceAdjustmentType } from "@contractflow/contracts-schema"

export interface IInvoiceAdjustmentEntity {
    invoiceId : string
    adjustmentType : InvoiceAdjustmentType
    description : string
    rateBps : number
    baseAmountMinor : number
    amountMinor : number
    currencyCode : string

}