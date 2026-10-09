import { ECompanyRole, ECompanyUserStatus } from "@contractflow/contracts-schema"

export interface ICompanyUserEntity {
    companyId : string
    userId : string
    companyRole : ECompanyRole
    jobTitle : string
    status : ECompanyUserStatus
    joinedAt : Date
    leftAt : Date
}