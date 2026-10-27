import type { EContractRole } from '@contractflow/contracts-schema';
import type { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import {
  workspaceForRole,
  type AssignableContractWorkspace,
} from '../services/contract-workspace';

export class ContractRoleAssignmentResponseDto {
  id!: string;
  contractPartyId!: string;
  companyUserId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  role!: EContractRole;
  workspace!: AssignableContractWorkspace;
  isWorkspaceAdmin!: boolean;
  assignedAt!: string;
  assignedById!: string;
  revokedAt!: string | null;
  revokedById!: string | null;

  static fromEntity(
    assignment: ContractRoleAssignment,
  ): ContractRoleAssignmentResponseDto {
    const response = new ContractRoleAssignmentResponseDto();
    response.id = assignment.id;
    response.contractPartyId = assignment.contractPartyId;
    response.companyUserId = assignment.companyUserId;
    response.firstName = assignment.companyUser.user.firstName;
    response.lastName = assignment.companyUser.user.lastName;
    response.email = assignment.companyUser.user.email;
    response.role = assignment.role;
    response.workspace = workspaceForRole(assignment.role);
    response.isWorkspaceAdmin = assignment.isWorkspaceAdmin;
    response.assignedAt = assignment.assignedAt.toISOString();
    response.assignedById = assignment.assignedById;
    response.revokedAt = assignment.revokedAt?.toISOString() ?? null;
    response.revokedById = assignment.revokedById;
    return response;
  }
}
