import { InvitationRole, InvitationStatus } from "@contractflow/contracts-schema"

export interface ICompanyInvitationEntity {
    companyId : string
    invitedByCompanyUserId : string
    email : string
    firstName : string
    lastName : string
    companyRole : InvitationRole
    tokenHash : string
    status : InvitationStatus
    expiresAt : Date
    acceptedAt : Date
}