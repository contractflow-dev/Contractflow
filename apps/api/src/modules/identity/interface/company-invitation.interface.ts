import { EInvitationRole, EInvitationStatus } from "@contractflow/contracts-schema"

export interface ICompanyInvitationEntity {
    companyId : string
    invitedByCompanyUserId : string
    email : string
    firstName : string
    lastName : string
    companyRole : EInvitationRole
    tokenHash : string
    status : EInvitationStatus
    expiresAt : Date
    acceptedAt : Date
}