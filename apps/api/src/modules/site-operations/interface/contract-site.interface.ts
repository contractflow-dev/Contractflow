import { EContractSiteStatus } from "@contractflow/contracts-schema"

export interface IContractSiteEntity {
    contractId : string
    name : string
    siteCode : string
    addressLine1 : string
    city : string
    stateRegion : string
    countryCode : string
    latitudeE6 : number
    longitudeE6 : number
    status : EContractSiteStatus
}