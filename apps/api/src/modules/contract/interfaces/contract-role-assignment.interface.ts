import { ContractRole } from "@contractflow/contracts-schema"

export interface IContractRoleAssignmentEntity {
    contractPartyId : string
    companyUserId : string
    companyId : string
    role : ContractRole
    assignedAt : Date
    assignedById : string
    revokedAt : Date
    revokedById : string
}