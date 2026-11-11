import type {
  IPaginationQuery,
  ISortQuery,
} from "../../../common/interfaces/pagination.interface.js";
import type {
  ContractRole,
  ContractRoleSide,
  EContractSortField,
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
  currencyCode: ECurrencyCode;
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

/** Another company that is party to a contract, as shown in the contract list. */
export interface ContractCounterparty {
  companyName: string;
  partyType: EPartyType;
}

/** One of the signed-in user's own active roles on a listed contract. */
export interface ContractListRole {
  role: ContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
}

/** A contract-list row: the contract and the other parties to it. */
export interface ContractListItem extends Contract {
  /** Every party except the requesting company; empty for archived contracts. */
  counterparties: ContractCounterparty[];
  /** The signed-in user's active roles on it; empty when none or archived. */
  myRoles: ContractListRole[];
}

export interface ContractFilterParams
  extends IPaginationQuery,
    ISortQuery<EContractSortField> {
  status?: EContractStatus;
  search?: string;
  includeDeleted?: boolean;
  /** Only contracts the signed-in user holds an active role on. */
  assignedToMe?: boolean;
}

export interface ContractPartySummary {
  id: string;
  companyId: string;
  companyName: string;
  partyType: EPartyType;
  signedAt: string | null;
}

export interface RecordContractSignatoryRequest {
  signatoryFirstName: string;
  signatoryLastName: string;
  signatoryTitle: string;
  signedAt: string;
}

export interface ContractMembership {
  id: string;
  companyId: string;
  partyType: EPartyType;
  signedAt: string | null;
}

/** The acting company's own signatory; readable only by its Company Administrators. */
export interface ContractPartySignatory {
  id: string;
  companyId: string;
  partyType: EPartyType;
  signatoryFirstName: string | null;
  signatoryLastName: string | null;
  signatoryTitle: string | null;
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

export interface CompanyContractHistoryQuery
  extends CompanyContractDetailQuery,
    IPaginationQuery {
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

/**
 * A pending invitation for the header company to join another company's
 * contract, listed in the app for its Company Administrators.
 */
export interface IncomingContractInvitation {
  id: string;
  contractTitle: string;
  contractReference: string;
  invitingCompanyName: string;
  partyType: EPartyType;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface RespondIncomingContractInvitationRequest {
  decision: "accept" | "reject";
}

export interface RespondIncomingContractInvitationResponse {
  status: "accepted" | "rejected";
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
  role: ContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  assignedAt: string;
  assignedById: string;
  revokedAt: string | null;
  revokedById: string | null;
}

/**
 * An active contract role held by a member of the header company, listed
 * across all of the company's contracts that are not archived.
 */
export interface CompanyRoleAssignment {
  id: string;
  contractId: string;
  contractReference: string;
  contractTitle: string;
  contractStatus: EContractStatus;
  companyUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: ContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  assignedAt: string;
}

/** Filters that narrow the header company's role assignments. */
export interface CompanyRoleAssignmentFilters {
  companyUserId?: string;
  workspace?: AssignableContractWorkspace;
}

export interface ContractRoleInvitation {
  id: string;
  email: string;
  role: ContractRole;
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
  role: ContractRole;
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

/**
 * The signed-in member's standing in one of a contract's workspaces. Only
 * the caller's own active roles are ever included; never anyone else's.
 */
/**
 * Whether the caller may manage one workspace's team for their company, and
 * which roles their company's party may hold there: client roles for a
 * CLIENT party, contractor roles for any other party type.
 */
export interface ContractRoleManagementPermissions {
  canManage: boolean;
  canGrantWorkspaceAdmin: boolean;
  roleSide: ContractRoleSide;
  roles: ContractRole[];
}

export interface ContractWorkspaceAccess {
  workspace: AssignableContractWorkspace;
  /** True when the member holds an active role in this workspace. */
  hasAccess: boolean;
  /** The member's active roles in this workspace (none without access). */
  roles: ContractRole[];
  /** Workspace Admin rights on one of those roles. */
  isWorkspaceAdmin: boolean;
  /**
   * May manage this workspace's team for the member's company: holds a role
   * here and is a Workspace Admin or a Company Administrator. The role routes
   * check this again on every change.
   */
  canManageTeam: boolean;
}

/** `GET /contract/workspace-access`: every workspace enabled on the contract. */
export interface ContractWorkspaceAccessResponse {
  workspaces: ContractWorkspaceAccess[];
}
