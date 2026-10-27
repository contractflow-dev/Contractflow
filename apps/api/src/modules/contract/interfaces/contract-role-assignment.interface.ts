import { EContractRole } from '@contractflow/contracts-schema';

export interface IContractRoleAssignmentEntity {
  contractPartyId: string;
  companyUserId: string;
  companyId: string;
  role: EContractRole;
  isWorkspaceAdmin: boolean;
  assignedAt: Date;
  assignedById: string;
  revokedAt: Date | null;
  revokedById: string | null;
}
