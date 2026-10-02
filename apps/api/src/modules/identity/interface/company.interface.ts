import { CompanyStatus } from "../entities/company.entity"

export interface ICompanyEntity {
    name : string
    legalName : string
    registrationNumber : string
    taxIdentificationNumber : string
    email : string
    phoneNumber : string
    website : string
    addressLine1 : string
    addressLine2 : string
    city : string
    stateRegion : string
    postalCode : string
    countryCode : string
    defaultCurrencyCode : string
    status : CompanyStatus
    verifiedAt : Date
}