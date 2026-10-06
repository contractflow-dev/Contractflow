
export interface IInventoryItemEntity {
    contractId : string
    contractSiteId : string
    contractPartyId : string
    itemCode : string
    name : string
    category : string
    unitOfMeasure : string
    quantityOnHandMilli : number
    reorderLevelMilli : number
}