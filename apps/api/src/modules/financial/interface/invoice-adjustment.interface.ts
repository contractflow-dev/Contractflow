import { InvoiceAdjustmentType } from "../entities/invoice-adjustment.entity"

export interface IInvoiceAdjustmentEntity {
    invoiceId : string
    adjustmentType : InvoiceAdjustmentType
    description : string
    rateBps : number
    baseAmountMinor : number
    amountMinor : number
    currencyCode : string

}