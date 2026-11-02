import type {
  EContractRole,
  EContractStatus,
  EContractType,
  EFromStatus,
  EPartyType,
  EToStatus,
} from "../enums/contract.enum.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  contractType: EContractType;
  status: EContractStatus;
  parentContractId: string | null;
  originalValueMinor: number | string;
  currentValueMinor: number | string;
  currencyCode: string;
  retentionRateBps: number;
  advancePaymentRateBps: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor: number | string | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate: string | null;
  actualCompletionDate: string | null;
  defectsLiabilityDays: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ContractPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ContractFilterParams {
  status?: EContractStatus;
  search?: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface ContractPartySummary {
  id: string;
  companyId: string;
  companyName: string;
  partyType: EPartyType;
  signedAt: string | null;
}

export interface ContractMembership {
  id: string;
  companyId: string;
  partyType: EPartyType;
  signedAt: string | null;
}

export interface ContractDetail {
  contract: Contract;
  membership: ContractMembership;
}

export interface ContractStatusHistory {
  id: string;
  contractId: string;
  fromStatus: EFromStatus | null;
  toStatus: EToStatus;
  reason: string | null;
  changedById: string;
  changedAt: string;
  changedBy?: { userId: string; firstName: string; lastName: string } | null;
}

export interface CompanyContractQuery extends ContractFilterParams {
  companyId: string;
}

export interface CompanyContractDetailQuery {
  companyId: string;
  contractId: string;
}

export interface CompanyContractHistoryQuery extends CompanyContractDetailQuery {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  status?: EContractStatus;
  userId?: string;
}

export type AssignableContractWorkspace = "project" | "hse" | "finance";
export type ContractTransition = "activate" | "hold" | "resume" | "complete";

export interface ContractPartyInvitation {
  id: string;
  email: string;
  partyType: EPartyType;
  status: "pending" | "accepted" | "rejected" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  revokedAt: string | null;
}

export interface ContractPartyInvitationPreview {
  companyId: string;
  contractTitle: string;
  invitingCompanyName: string;
  email: string;
  partyType: EPartyType;
  expiresAt: string;
}

export interface CreateContractRequest {
  referenceNumber: string;
  title: string;
  description?: string | null;
  contractType: EContractType;
  partyType: EPartyType;
  workspaces: AssignableContractWorkspace[];
  parentContractId?: string | null;
  originalValueMinor: number;
  currencyCode: ECurrencyCode;
  retentionRateBps: number;
  advancePaymentRateBps?: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor?: number | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate?: string | null;
  actualCompletionDate?: string | null;
  defectsLiabilityDays: number;
  timezone: string;
}

export interface ContractRoleAssignment {
  id: string;
  contractPartyId: string;
  companyUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  assignedAt: string;
  assignedById: string;
  revokedAt: string | null;
  revokedById: string | null;
}

export interface ContractRoleInvitation {
  id: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  status: "pending" | "accepted" | "rejected" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  revokedAt: string | null;
}

export interface ContractRoleInvitationPreview {
  contractTitle: string;
  companyName: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  expiresAt: string;
}

export interface ContractRoleAssignmentQuery extends CompanyContractDetailQuery {
  workspace: AssignableContractWorkspace;
}

export interface ContractLifecyclePermissions {
  canManage: boolean;
  canTransition: boolean;
  canRestore: boolean;
}
