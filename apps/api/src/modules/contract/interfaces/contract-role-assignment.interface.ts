import { EContractRole } from "@contractflow/contracts-schema"

export interface IContractRoleAssignmentEntity {
    contractPartyId : string
    companyUserId : string
    companyId : string
    role : EContractRole
    assignedAt : Date
    assignedById : string
    revokedAt : Date
    revokedById : string
}