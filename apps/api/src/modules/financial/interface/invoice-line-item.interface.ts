import { ECurrencyCode } from "@contractflow/contracts-schema";

export interface IInvoiceLineItemEntity {
    invoiceId : string
    milestoneId : string
    lineNumber : number
    description : string
    quantityMilli : number
    unitOfMeasure : string
    unitPriceMinor : string
    amountMinor : string
    currencyCode : ECurrencyCode
}