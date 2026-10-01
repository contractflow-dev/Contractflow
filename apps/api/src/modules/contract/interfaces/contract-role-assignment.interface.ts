import { ContractRole } from "../entities/contract-role-assignment.entity"

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