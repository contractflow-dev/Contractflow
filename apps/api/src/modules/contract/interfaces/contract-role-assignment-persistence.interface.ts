import type {
  ECompanyRole,
  ECompanyUserStatus,
  ContractRole,
  EContractStatus,
  EPartyType,
} from '@contractflow/contracts-schema';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export type ContractRoleInvitationStatus =
  'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';

export const CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE = Symbol(
  'CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE',
);
export const CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK = Symbol(
  'CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK',
);

export interface IRoleAssignmentMember {
  id: string;
  userId: string;
  companyId: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  leftAt?: Date | null;
  user?: { firstName: string; lastName: string; email: string };
}

export interface IRoleAssignmentParty {
  id: string;
  contractId: string;
  companyId: string;
  partyType: EPartyType;
}

export interface IRoleAssignmentRecord {
  id: string;
  contractPartyId: string;
  companyUserId: string;
  companyId: string;
  role: ContractRole;
  isWorkspaceAdmin: boolean;
  assignedAt: Date;
  assignedById: string;
  revokedAt: Date | null;
  revokedById: string | null;
  companyUser?: {
    user: { firstName: string; lastName: string; email: string };
  };
}

export interface IRoleInvitationRecord {
  id: string;
  contractPartyId: string;
  companyId: string;
  invitedById: string;
  email: string;
  role: ContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  tokenHash: string;
  status: ContractRoleInvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  revokedAt: Date | null;
}

/** An active role held by a member of the company, with its contract. */
export interface ICompanyRoleAssignmentRow {
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
  isWorkspaceAdmin: boolean;
  assignedAt: Date;
}

export interface ICreateRoleAssignment {
  contractPartyId: string;
  companyUserId: string;
  role: ContractRole;
  isWorkspaceAdmin: boolean;
  assignedAt: Date;
  assignedById: string;
  revokedAt: null;
  revokedById: null;
}

export interface ICreateRoleInvitation {
  contractPartyId: string;
  companyId: string;
  invitedById: string;
  email: string;
  role: ContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  tokenHash: string;
  status: 'pending';
  expiresAt: Date;
  respondedAt: null;
  revokedAt: null;
}

export interface IContractRoleAssignmentRepositories {
  memberships: {
    findActiveMember(
      companyId: string,
      userId: string,
    ): Promise<IRoleAssignmentMember | null>;
    findActiveById(
      companyId: string,
      id: string,
    ): Promise<IRoleAssignmentMember | null>;
    findActiveByEmail(
      companyId: string,
      email: string,
    ): Promise<IRoleAssignmentMember | null>;
    listEligible(companyId: string): Promise<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      }>
    >;
  };
  parties: {
    findByContractAndCompany(
      contractId: string,
      companyId: string,
    ): Promise<IRoleAssignmentParty | null>;
    findByIdAndCompany(
      id: string,
      companyId: string,
    ): Promise<IRoleAssignmentParty | null>;
    findByIdAndCompanyForUpdate(
      id: string,
      companyId: string,
    ): Promise<IRoleAssignmentParty | null>;
    findForUpdate(
      contractId: string,
      companyId: string,
    ): Promise<IRoleAssignmentParty | null>;
  };
  contracts: {
    findActive(contractId: string): Promise<{ id: string } | null>;
    findActiveForUpdate(contractId: string): Promise<{ id: string } | null>;
    findInvitationDetails(
      contractId: string,
    ): Promise<{ id: string; title: string } | null>;
  };
  companies: {
    findName(companyId: string): Promise<string | null>;
  };
  workspaces: {
    exists(
      contractId: string,
      workspace: AssignableContractWorkspace,
    ): Promise<boolean>;
    /** The workspaces enabled on the contract. */
    listEnabled(contractId: string): Promise<AssignableContractWorkspace[]>;
  };
  assignments: {
    /**
     * Active roles held through the company's own party on contracts that
     * are not archived. Never another company's assignments.
     */
    listActiveForCompany(
      companyId: string,
      filters: { companyUserId?: string; roles?: ContractRole[] },
      page: { skip: number; take: number },
    ): Promise<{ items: ICompanyRoleAssignmentRow[]; total: number }>;
    findActiveForParty(
      companyId: string,
      partyId: string,
      contractId: string,
      roles: ContractRole[],
    ): Promise<IRoleAssignmentRecord[]>;
    hasWorkspaceAdmin(
      companyId: string,
      memberId: string,
      partyId: string,
      roles: ContractRole[],
    ): Promise<boolean>;
    /**
     * One member's active roles through the company's own party: the role
     * and Workspace Admin flag only, nothing about the person.
     */
    listActiveForMember(
      companyId: string,
      partyId: string,
      memberId: string,
    ): Promise<Array<{ role: ContractRole; isWorkspaceAdmin: boolean }>>;
    countActiveWorkspaceAdmins(
      companyId: string,
      partyId: string,
      roles: ContractRole[],
    ): Promise<number>;
    findActiveDuplicate(
      companyId: string,
      partyId: string,
      memberId: string,
      role: ContractRole,
    ): Promise<IRoleAssignmentRecord | null>;
    create(
      companyId: string,
      data: ICreateRoleAssignment,
    ): Promise<IRoleAssignmentRecord>;
    findByIdInPartyForUpdate(
      companyId: string,
      id: string,
      partyId: string,
    ): Promise<IRoleAssignmentRecord | null>;
    revoke(
      assignment: IRoleAssignmentRecord,
      at: Date,
      actorId: string,
    ): Promise<IRoleAssignmentRecord>;
    save(assignment: IRoleAssignmentRecord): Promise<IRoleAssignmentRecord>;
    load(
      companyId: string,
      partyId: string,
      id: string,
    ): Promise<IRoleAssignmentRecord | null>;
  };
  invitations: {
    expireForParty(
      partyId: string,
      workspace: AssignableContractWorkspace,
      at: Date,
    ): Promise<void>;
    listForParty(
      companyId: string,
      partyId: string,
      workspace: AssignableContractWorkspace,
    ): Promise<IRoleInvitationRecord[]>;
    findByTokenHash(tokenHash: string): Promise<IRoleInvitationRecord | null>;
    expirePending(
      partyId: string,
      email: string,
      role: ContractRole,
      at: Date,
    ): Promise<void>;
    findPending(
      partyId: string,
      email: string,
      role: ContractRole,
    ): Promise<IRoleInvitationRecord | null>;
    create(data: ICreateRoleInvitation): Promise<IRoleInvitationRecord>;
    findByIdForUpdate(
      id: string,
      partyId: string,
      companyId: string,
      tokenHash?: string,
    ): Promise<IRoleInvitationRecord | null>;
    expireById(id: string): Promise<void>;
    save(invitation: IRoleInvitationRecord): Promise<IRoleInvitationRecord>;
  };
  activities: {
    write(data: {
      contractId: string;
      companyId: string;
      actorUserId: string;
      action: string;
      entityType: 'contract_role_assignment' | 'contract_role_invitation';
      entityId: string;
      summary: string;
      changes: {
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
      };
      metadata: Record<string, unknown>;
      ipAddress: null;
      userAgent: null;
      requestId: null;
      occurredAt: Date;
    }): Promise<void>;
  };
}

export type IContractRoleAssignmentTransactionContext =
  IContractRoleAssignmentRepositories;
export type IContractRoleAssignmentUnitOfWork =
  IUnitOfWork<IContractRoleAssignmentTransactionContext>;
