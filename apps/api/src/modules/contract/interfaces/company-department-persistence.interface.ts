import type {
  ContractRole,
  EContractStatus,
  EPartyType,
} from '@contractflow/contracts-schema';
import type { ICompanyOversightScope } from '../services/contract-access.service';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export const COMPANY_DEPARTMENT_PERSISTENCE = Symbol(
  'COMPANY_DEPARTMENT_PERSISTENCE',
);

/** A company on the contract, as the parties view already shows it. */
export interface IDepartmentParty {
  companyId: string;
  companyName: string;
  partyType: EPartyType;
  signedAt: Date | null;
}

/** A member of the overseeing company with an active role in the workspace. */
export interface IDepartmentMemberRecord {
  companyUserId: string;
  firstName: string;
  lastName: string;
  isWorkspaceAdmin: boolean;
}

/**
 * Everything the department page needs about one contract, read in one
 * query. Only oversight information: the contract, its parties and status
 * history, the company's own invitations, and the company's own role
 * assignments and role invitations. No workspace content and nobody from
 * another company.
 */
export interface IDepartmentContractRecord {
  contractId: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  archived: boolean;
  ownerCompanyId: string | null;
  ownerCompanyName: string | null;
  /** The overseeing company's party type. */
  partyType: EPartyType;
  contractUpdatedAt: Date;
  lastStatusChangeAt: Date | null;
  /** Who made the latest change to Suspended, when there is one. */
  suspendedByCompanyId: string | null;
  suspendedByCompanyName: string | null;
  parties: IDepartmentParty[];
  /** Pending, unexpired invitations the company sent for this contract. */
  pendingPartyInvitations: Array<{ companyId: string; companyName: string }>;
  members: IDepartmentMemberRecord[];
  /** The company's pending, unexpired role invitations for the workspace. */
  pendingRoleInvitationCount: number;
  /** The requesting administrator holds a role in the workspace. */
  requesterHasRole: boolean;
}

/** Read-only queries behind the Company Administrator's department pages. */
export interface ICompanyDepartmentPersistence {
  /**
   * Contracts where the workspace exists and the scope's company is a
   * party. Archived ones only on request, and only those the company
   * created (as the contract register shows them).
   */
  listContracts(
    scope: ICompanyOversightScope,
    workspace: AssignableContractWorkspace,
    roles: ContractRole[],
    options: { includeArchived: boolean; now: Date },
  ): Promise<IDepartmentContractRecord[]>;
}
