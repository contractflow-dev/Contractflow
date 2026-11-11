import type { ContractRole } from '@contractflow/contracts-schema';

export interface IContractRoleAssignmentEntity {
  contractPartyId: string;
  companyUserId: string;
  companyId: string;
  role: ContractRole;
  isWorkspaceAdmin: boolean;
  assignedAt: Date;
  assignedById: string;
  revokedAt: Date | null;
  revokedById: string | null;
}
