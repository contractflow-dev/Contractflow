import type { EContractRole } from '@contractflow/contracts-schema';
import type { ContractRoleInvitationStatus } from '../interfaces/contract-role-assignment-persistence.interface';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export class ContractRoleInvitationResponseDto {
  id!: string;
  email!: string;
  role!: EContractRole;
  workspace!: AssignableContractWorkspace;
  isWorkspaceAdmin!: boolean;
  status!: ContractRoleInvitationStatus;
  createdAt!: string;
  expiresAt!: string;
  respondedAt!: string | null;
  revokedAt!: string | null;

  static fromEntity(invitation: {
    id: string;
    email: string;
    role: EContractRole;
    workspace: AssignableContractWorkspace;
    isWorkspaceAdmin: boolean;
    status: ContractRoleInvitationStatus;
    createdAt: Date;
    expiresAt: Date;
    respondedAt: Date | null;
    revokedAt: Date | null;
  }): ContractRoleInvitationResponseDto {
    const response = new ContractRoleInvitationResponseDto();
    response.id = invitation.id;
    response.email = invitation.email;
    response.role = invitation.role;
    response.workspace = invitation.workspace;
    response.isWorkspaceAdmin = invitation.isWorkspaceAdmin;
    response.status = invitation.status;
    response.createdAt = invitation.createdAt.toISOString();
    response.expiresAt = invitation.expiresAt.toISOString();
    response.respondedAt = invitation.respondedAt?.toISOString() ?? null;
    response.revokedAt = invitation.revokedAt?.toISOString() ?? null;
    return response;
  }
}

export interface ContractRoleInvitationPreviewDto {
  contractTitle: string;
  companyName: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  expiresAt: string;
}
