import { CompanyRole, CompanyUserStatus } from "../entities/company-user.entity"

export interface ICompanyUserEntity {
    companyId : string
    userId : string
    companyRole : CompanyRole
    jobTitle : string
    status : CompanyUserStatus
    joinedAt : Date
    leftAt : Date
}