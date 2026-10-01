import { TransactionType } from "../entities/inventory-transaction.entity"

export interface IInventoryTransactionEntity {
    contractId : string
    inventoryItemId : string
    siteDailyLogId : string
    transactionType : TransactionType
    quantityMilli : number
    unitCostMinor : number
    currencyCode : string
    referenceNumber : string
    counterPartyName : string
    transactionAt : string
    performedById : string
    remarks : string
}