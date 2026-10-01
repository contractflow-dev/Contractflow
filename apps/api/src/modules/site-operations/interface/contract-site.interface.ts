import { ContractVariation } from "../../delivery/entities/contract-variation.entity"
import { ContractSiteStatus } from "../entities/contract-site.entity"

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
    status : ContractSiteStatus
}