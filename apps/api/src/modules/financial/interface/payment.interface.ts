import { EPaymentMethod, EPaymentStatus, ECurrencyCode } from "@contractflow/contracts-schema"

export interface IPaymentEntity {
    contractId : string
    invoiceId : string
    paymentReference : string
    idempotencyKey : string
    amountMinor : number
    currencyCode : ECurrencyCode
    invoiceAmountMinor : number
    invoiceCurrencyCode : string
    fxBaseCurrencyCode : string
    fxRateMicro : number
    fxRateSource : string
    fxRateAt : Date
    paymentMethod : EPaymentMethod
    status : EPaymentStatus
    paymentDate : Date
    externalReference : string
    recordedAt : Date
    recordedById : string
    approvedAt : Date
    approvedById : string
    receiptConfirmedAt : Date
    receiptConfirmedById : string
    notes : string
}