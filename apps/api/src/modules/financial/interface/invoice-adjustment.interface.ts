import { EInvoiceAdjustmentType, ECurrencyCode } from "@contractflow/contracts-schema"

export interface IInvoiceAdjustmentEntity {
    invoiceId : string
    adjustmentType : EInvoiceAdjustmentType
    description : string
    rateBps : number
    baseAmountMinor : string
    amountMinor : string
    currencyCode : ECurrencyCode

}