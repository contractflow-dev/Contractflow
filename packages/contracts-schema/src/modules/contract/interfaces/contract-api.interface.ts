import type {
  IPaginatedResponse,
  IPaginationQuery,
  ISortQuery,
} from "../../../common/interfaces/pagination.interface.js";
import type {
  ContractRole,
  ContractRoleSide,
  EContractSortField,
  EContractStatus,
  EContractType,
  EDepartmentBlockerType,
  EDepartmentContractSort,
  EFromStatus,
  EPartyType,
  EToStatus,
} from "../enums/contract.enum.js";
import type { MinorAmount } from "../../../common/money/minor-amount.js";
import type { ECurrencyCode } from "../../identity/enums/identity.enum.js";

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  contractType: EContractType;
  status: EContractStatus;
  parentContractId: string | null;
  /**
   * The lifecycle template version the stages were copied from; null for a
   * contract created before lifecycles, whose stage plan stays editable.
   */
  lifecycleTemplateVersionId: string | null;
  originalValueMinor: MinorAmount;
  currentValueMinor: MinorAmount;
  currencyCode: ECurrencyCode;
  retentionRateBps: number;
  advancePaymentRateBps: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor: MinorAmount | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate: string | null;
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
/**
 * A related contract (a subcontract's main contract, or a main contract's
 * subcontract), named only when the reader may see it.
 */
export interface ContractRelationSummary {
  id: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
}

export interface ContractListItem extends Contract {
  /**
   * A subcontract's main contract when the reader may see it; null for a
   * main contract, or when the main contract isn't visible to the reader
   * (`parentContractId` still marks it as a subcontract).
   */
  parentContract: ContractRelationSummary | null;
  /** The requesting company's own party type on the contract. */
  myPartyType: EPartyType | null;
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
  /**
   * The main contract of a subcontract, when the reader may see it. Null for
   * a main contract, or a main contract the reader can't open.
   */
  parentContract: ContractRelationSummary | null;
  /** The subcontracts of a main contract that the reader may see. */
  subcontracts: ContractRelationSummary[];
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
/**
 * activate: draft to active. hold / resume: active to suspended and back.
 * practical_completion: active to defects liability. complete: active or
 * defects liability to completed.
 */
export type ContractTransition =
  | "activate"
  | "hold"
  | "resume"
  | "practical_completion"
  | "complete";

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
  originalValueMinor: MinorAmount;
  currencyCode: ECurrencyCode;
  retentionRateBps: number;
  advancePaymentRateBps?: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor?: MinorAmount | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate?: string | null;
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
  /**
   * The caller may list, send and revoke this contract's party invitations:
   * on a main contract its creating company's Company Administrator, on a
   * subcontract only the main contractor's Contractor Project Lead on the
   * main contract.
   */
  canInviteParties: boolean;
  /** This is a subcontract: an invited company joins as the subcontractor. */
  invitesSubcontractors: boolean;
  /**
   * The caller may create a subcontract of this main contract: the awarded
   * party's Contractor Project Lead, while it is draft or active.
   */
  canCreateSubcontract: boolean;
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

/**
 * What archiving (deleting) a contract would end, for its confirmation.
 * Counts only, across every party: no names or other parties' details.
 */
export interface ContractDeletionImpact {
  /** Active contract roles, which would be revoked. */
  activeRoleAssignmentCount: number;
  /** Of those, how many hold workspace-administrator rights. */
  workspaceAdminCount: number;
  /** Pending role invitations, which would be revoked. */
  pendingRoleInvitationCount: number;
  /** Pending invitations to other companies, which would be revoked. */
  pendingPartyInvitationCount: number;
  /** Other companies party to the contract, who would lose sight of it. */
  otherPartyCount: number;
  /** Subcontracts that aren't archived; they are not archived with it. */
  subcontractCount: number;
}

/** Adds one workspace to a contract (the contract is in X-Contract-Id). */
export interface AddContractWorkspaceRequest {
  workspace: AssignableContractWorkspace;
}

/**
 * What removing a workspace would end, across every party to the contract.
 * Counts only: no names or other parties' details.
 */
export interface ContractWorkspaceRemovalImpact {
  workspace: AssignableContractWorkspace;
  /** Active contract roles in the workspace, which would be revoked. */
  activeRoleAssignmentCount: number;
  /** Of those, how many hold workspace-administrator rights. */
  workspaceAdminCount: number;
  /** Pending role invitations to the workspace, which would be revoked. */
  pendingRoleInvitationCount: number;
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

/**
 * The company a department blocker waits on. `companyId` and `companyName`
 * are null when it can't be told ("Unknown").
 */
export interface DepartmentBlockerHolder {
  companyId: string | null;
  companyName: string | null;
  /** The holder is the Company Administrator's own company. */
  myCompany: boolean;
}

export interface DepartmentBlocker {
  type: EDepartmentBlockerType;
  /** Plain language, for example "Invitation to Ridgeline Ltd is pending". */
  label: string;
  holder: DepartmentBlockerHolder;
}

/** A member of the Company Administrator's own company. */
export interface DepartmentMember {
  companyUserId: string;
  firstName: string;
  lastName: string;
}

/**
 * `GET /company/departments/:department/contracts`: one contract where the
 * department's workspace exists and the company is a party. Only oversight
 * information: no workspace content, and only the company's own people.
 */
export interface DepartmentContract {
  contractId: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  /** Archived contracts are listed only on request, read-only. */
  archived: boolean;
  /** The company's own party type on the contract. */
  partyType: EPartyType;
  /** Distinct members of the company with an active role in the workspace. */
  memberCount: number;
  /** The first few of them, Workspace Admins first. */
  members: DepartmentMember[];
  /** The company's Workspace Admins in the workspace; empty when none. */
  workspaceAdmins: DepartmentMember[];
  /** The highest-ranked blocker; null when nothing holds progress. */
  primaryBlocker: DepartmentBlocker | null;
  /** How many more blockers apply. */
  otherBlockerCount: number;
  /** The latest status change or contract edit. */
  lastMovementAt: string;
  daysSinceMovement: number;
  /** The requesting administrator holds a role in this workspace. */
  hasWorkspaceRole: boolean;
}

export interface DepartmentContractsSummary {
  /** Contracts (not archived) where the workspace exists. */
  contractCount: number;
  /** Distinct members of the company with a role in the workspace. */
  memberCount: number;
  /** Contracts whose main blocker waits on the company. */
  waitingOnMyCompanyCount: number;
  /** Contracts whose main blocker waits on another company. */
  waitingOnOtherCompaniesCount: number;
}

export interface DepartmentContractsResponse extends IPaginatedResponse<DepartmentContract> {
  summary: DepartmentContractsSummary;
}

/** Whose move a contract waits on, by its main blocker. */
export type DepartmentWaitingOn = "us" | "others";

/** Filters, order and page of the department contract list. */
export interface DepartmentContractsQuery extends IPaginationQuery {
  search?: string;
  status?: EContractStatus;
  partyType?: EPartyType;
  /**
   * Only contracts whose main blocker waits on the company (`us`) or on
   * another company (`others`).
   */
  waitingOn?: DepartmentWaitingOn;
  sort?: EDepartmentContractSort;
  /** Also list archived contracts the company created (read-only). */
  includeArchived?: boolean;
}
