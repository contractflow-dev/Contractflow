import { InvitationRole, InvitationStatus } from "../entities/company-invitation.entity"

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