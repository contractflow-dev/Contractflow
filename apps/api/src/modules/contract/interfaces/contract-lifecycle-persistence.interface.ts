import type {
  ContractRole,
  EFromStatus,
  EPartyType,
  EToStatus,
} from '@contractflow/contracts-schema';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { Company } from '../../identity/entities/company.entity';
import type { CompanyUser } from '../../identity/entities/company-user.entity';
import type { Contract } from '../entities/contract.entity';
import type {
  ContractPartyInvitation,
  InvitableContractPartyType,
} from '../entities/contract-party-invitation.entity';
import type { ContractParty } from '../entities/contract-party.entity';
import type { ContractSite } from '../../site-operations/entities/contract-site.entity';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

export const CONTRACT_LIFECYCLE_UNIT_OF_WORK = Symbol(
  'CONTRACT_LIFECYCLE_UNIT_OF_WORK',
);

export type ICreateContractRecord = Partial<Contract>;

export type IContractPermissionSnapshot = Pick<
  Contract,
  'id' | 'createdByCompanyId' | 'deletedAt'
>;

export interface IContractPartyWithRelations extends ContractParty {
  contract: Contract;
  company: Company;
}

export interface ILifecycleCompanyRepository {
  findActiveForShare(companyId: string): Promise<Company | null>;
  findActiveVerifiedByEmail(email: string): Promise<Company[]>;
}

export interface ILifecycleMembershipRepository {
  findActive(userId: string, companyId: string): Promise<CompanyUser | null>;
  findActiveForUpdate(
    userId: string,
    companyId: string,
  ): Promise<CompanyUser | null>;
}

export interface ILifecycleContractRepository {
  findPermissionSnapshot(
    contractId: string,
  ): Promise<IContractPermissionSnapshot | null>;
  findForUpdate(contractId: string): Promise<Contract | null>;
  findActiveForUpdate(contractId: string): Promise<Contract | null>;
  findActiveById(contractId: string): Promise<Contract | null>;
  create(data: ICreateContractRecord): Promise<Contract>;
  save(contract: Contract): Promise<Contract>;
  parentWouldCreateCycle(
    parentContractId: string,
    contractId: string,
  ): Promise<boolean>;
}

export interface ILifecyclePartyRepository {
  find(contractId: string, companyId: string): Promise<ContractParty | null>;
  findForShare(
    contractId: string,
    companyId: string,
  ): Promise<ContractParty | null>;
  findByIdWithContractAndCompany(
    partyId: string,
  ): Promise<IContractPartyWithRelations | null>;
  findById(partyId: string): Promise<ContractParty | null>;
  findForUpdate(
    contractId: string,
    companyId: string,
  ): Promise<ContractParty | null>;
  save(party: ContractParty): Promise<ContractParty>;
  create(data: {
    contractId: string;
    companyId: string;
    partyType: EPartyType;
  }): Promise<ContractParty>;
}

export interface ILifecycleWorkspaceRepository {
  listWorkspaces(contractId: string): Promise<AssignableContractWorkspace[]>;
  addMany(
    contractId: string,
    workspaces: AssignableContractWorkspace[],
    createdByCompanyUserId: string,
  ): Promise<void>;
  remove(
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<void>;
}

export interface IActiveAssignmentCriteria {
  companyId: string;
  contractPartyId: string;
  companyUserId: string;
  role: ContractRole;
}

export interface ILifecycleRoleAssignmentRepository {
  hasActiveAssignment(criteria: IActiveAssignmentCriteria): Promise<boolean>;
  /** Whether the member holds any active role on the party (visibility). */
  hasAnyActiveAssignment(
    criteria: Omit<IActiveAssignmentCriteria, 'role'>,
  ): Promise<boolean>;
  hasActiveAssignmentForShare(
    criteria: IActiveAssignmentCriteria,
  ): Promise<boolean>;
  revokeForWorkspaceRoles(
    contractId: string,
    roles: ContractRole[],
    revokedById: string,
    now: Date,
  ): Promise<void>;
  revokeAllForContract(
    contractId: string,
    revokedById: string,
    now: Date,
  ): Promise<void>;
}

export interface ILifecycleRoleInvitationRepository {
  revokePendingForWorkspace(
    contractId: string,
    workspace: AssignableContractWorkspace,
    now: Date,
  ): Promise<void>;
  revokeAllPendingForContract(contractId: string, now: Date): Promise<void>;
}

export interface ICreatePartyInvitationRecord {
  sourceContractPartyId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  invitedByCompanyUserId: string;
  acceptedByCompanyUserId: null;
  partyType: InvitableContractPartyType;
  email: string;
  tokenHash: string;
  status: 'pending';
  expiresAt: Date;
  respondedAt: null;
  revokedAt: null;
}

export interface IPendingInvitationCriteria {
  sourcePartyId: string;
  targetCompanyId: string;
  partyType: InvitableContractPartyType;
}

/** A pending invitation addressed to a company, with what it needs to see. */
export interface IIncomingPartyInvitationRow {
  id: string;
  partyType: InvitableContractPartyType;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  contractTitle: string;
  contractReference: string;
  invitingCompanyName: string;
}

export interface ILifecyclePartyInvitationRepository {
  expirePendingBySource(sourcePartyId: string, now: Date): Promise<void>;
  expireDuplicatePending(
    criteria: IPendingInvitationCriteria,
    now: Date,
  ): Promise<void>;
  findPendingDuplicate(
    criteria: IPendingInvitationCriteria,
  ): Promise<ContractPartyInvitation | null>;
  listBySource(sourcePartyId: string): Promise<ContractPartyInvitation[]>;
  findBySourceAndIdForUpdate(
    invitationId: string,
    sourcePartyId: string,
  ): Promise<ContractPartyInvitation | null>;
  /**
   * Pending, unexpired invitations addressed to the company, on contracts
   * that are not archived. Newest first.
   */
  listPendingForTarget(
    targetCompanyId: string,
    now: Date,
  ): Promise<IIncomingPartyInvitationRow[]>;
  /** Only ever finds an invitation addressed to the given company. */
  findByIdForTarget(
    invitationId: string,
    targetCompanyId: string,
  ): Promise<ContractPartyInvitation | null>;
  findByIdForTargetForUpdate(
    invitationId: string,
    targetCompanyId: string,
  ): Promise<ContractPartyInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<ContractPartyInvitation | null>;
  findByTokenHashForUpdate(
    tokenHash: string,
  ): Promise<ContractPartyInvitation | null>;
  expireIfPending(invitationId: string): Promise<void>;
  revokePendingBySource(sourcePartyId: string, now: Date): Promise<void>;
  create(data: ICreatePartyInvitationRecord): Promise<ContractPartyInvitation>;
  save(invitation: ContractPartyInvitation): Promise<ContractPartyInvitation>;
}

export type ICreateContractSiteRecord = Pick<
  ContractSite,
  | 'contractId'
  | 'name'
  | 'siteCode'
  | 'addressLine1'
  | 'city'
  | 'stateRegion'
  | 'countryCode'
  | 'latitudeE6'
  | 'longitudeE6'
  | 'status'
>;

export interface ILifecycleSiteRepository {
  listByContract(contractId: string): Promise<ContractSite[]>;
  findForUpdate(
    contractId: string,
    siteId: string,
  ): Promise<ContractSite | null>;
  findByCode(contractId: string, siteCode: string): Promise<ContractSite | null>;
  create(data: ICreateContractSiteRecord): Promise<ContractSite>;
  save(site: ContractSite): Promise<ContractSite>;
}

export interface IContractStatusHistoryRecord {
  contractId: string;
  fromStatus: EFromStatus | null;
  toStatus: EToStatus;
  reason: string | null;
  changedById: string;
  changedAt: Date;
}

export interface ILifecycleStatusHistoryRepository {
  record(data: IContractStatusHistoryRecord): Promise<void>;
}

export interface IContractActivityRecord {
  contractId: string;
  companyId: string;
  actorUserId: string;
  action: string;
  summary: string;
  changes: Record<string, unknown>;
  occurredAt: Date;
}

export interface ILifecycleActivityRepository {
  record(data: IContractActivityRecord): Promise<void>;
}

export interface IContractLifecycleContext {
  companies: ILifecycleCompanyRepository;
  memberships: ILifecycleMembershipRepository;
  contracts: ILifecycleContractRepository;
  parties: ILifecyclePartyRepository;
  workspaces: ILifecycleWorkspaceRepository;
  roleAssignments: ILifecycleRoleAssignmentRepository;
  roleInvitations: ILifecycleRoleInvitationRepository;
  partyInvitations: ILifecyclePartyInvitationRepository;
  sites: ILifecycleSiteRepository;
  statusHistory: ILifecycleStatusHistoryRepository;
  activity: ILifecycleActivityRepository;
}

export type IContractLifecycleUnitOfWork =
  IUnitOfWork<IContractLifecycleContext>;
