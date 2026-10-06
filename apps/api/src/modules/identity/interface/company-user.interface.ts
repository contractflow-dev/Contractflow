import { CompanyRole, CompanyUserStatus } from "@contractflow/contracts-schema"

export interface ICompanyUserEntity {
    companyId : string
    userId : string
    companyRole : CompanyRole
    jobTitle : string
    status : CompanyUserStatus
    joinedAt : Date
    leftAt : Date
}