import { ETransactionType, ECurrencyCode } from "@contractflow/contracts-schema"

export interface IInventoryTransactionEntity {
    contractId : string
    inventoryItemId : string
    siteDailyLogId : string
    transactionType : ETransactionType
    quantityMilli : number
    unitCostMinor : number
    currencyCode : ECurrencyCode
    referenceNumber : string
    counterPartyName : string
    transactionAt : string
    performedById : string
    remarks : string
}