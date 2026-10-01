
export interface IInvoiceLineItemEntity {
    invoiceId : string
    milestoneId : string
    lineNumber : number
    description : string
    quantityMilli : number
    unitOfMeasure : string
    unitPriceMinor : number
    amountMinor : number
    currencyCode : string
}