import { EInvoiceAdjustmentType } from "@contractflow/contracts-schema"

export interface IInvoiceAdjustmentEntity {
    invoiceId : string
    adjustmentType : EInvoiceAdjustmentType
    description : string
    rateBps : number
    baseAmountMinor : number
    amountMinor : number
    currencyCode : string

}