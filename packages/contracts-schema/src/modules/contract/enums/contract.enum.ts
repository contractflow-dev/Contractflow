
/**
 * A company's classification on one contract: the party that awarded it or
 * the party it was awarded to. On a main contract the client is AWARDING and
 * the contractor AWARDED; on a subcontract the main contractor is AWARDING
 * and the subcontractor AWARDED. A contract has at most one AWARDING party.
 */
export enum EPartyType {
  AWARDING = 'awarding',
  AWARDED = 'awarded',
}

/**
 * Contract roles held through an AWARDING party. HSE and Finance roles share
 * their stored values with the contractor side: the side comes from the
 * party the role is held through, never from the value alone.
 */
export enum EClientContractRole {
    CLIENT_PROJECT_MANAGER = 'Client Project Manager',
    CLIENT_SITE_ENGINEER = 'Client Site Engineer',
    HSE_OFFICER = 'HSE Officer',
    HSE_MANAGER = 'HSE Manager',
    FINANCE_OFFICER = 'Finance Officer',
    FINANCE_DIRECTOR = 'Finance Director',
}

/** Contract roles held through an AWARDED party. */
export enum EContractorContractRole {
    CONTRACTOR_PROJECT_LEAD = 'Contractor Project Lead',
    CONTRACTOR_SITE_SUPERVISOR = 'Contractor Site Supervisor',
    HSE_OFFICER = 'HSE Officer',
    HSE_MANAGER = 'HSE Manager',
    FINANCE_OFFICER = 'Finance Officer',
    FINANCE_DIRECTOR = 'Finance Director',
}

/** A stored contract role value, from either side. */
export type ContractRole = `${EClientContractRole}` | `${EContractorContractRole}`;

export const CLIENT_CONTRACT_ROLES: readonly ContractRole[] =
    Object.values(EClientContractRole);
export const CONTRACTOR_CONTRACT_ROLES: readonly ContractRole[] =
    Object.values(EContractorContractRole);

/**
 * Every distinct stored contract role value, in the database enum's label
 * order (contract_role_assignment_contract_role_enum).
 */
export const CONTRACT_ROLES: readonly ContractRole[] = [
    EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
    EClientContractRole.CLIENT_PROJECT_MANAGER,
    EClientContractRole.CLIENT_SITE_ENGINEER,
    EClientContractRole.HSE_OFFICER,
    EClientContractRole.HSE_MANAGER,
    EClientContractRole.FINANCE_OFFICER,
    EClientContractRole.FINANCE_DIRECTOR,
];

/**
 * Which role set a party uses: the client roles for the AWARDING party, the
 * contractor roles for the AWARDED party. The role names keep their client
 * and contractor wording on subcontracts too.
 */
export type ContractRoleSide = 'client' | 'contractor';

/**
 * How a contract role reads on screen. On a subcontract the main contractor
 * holds the awarding-side roles and the subcontractor the awarded-side ones,
 * so the client and contractor wording becomes main contractor and
 * subcontractor. Display only: the stored value is unchanged.
 */
const SUBCONTRACT_ROLE_LABELS: Readonly<Record<string, string>> = {
    [EClientContractRole.CLIENT_PROJECT_MANAGER]: 'Main Contractor Project Manager',
    [EClientContractRole.CLIENT_SITE_ENGINEER]: 'Main Contractor Site Engineer',
    [EContractorContractRole.CONTRACTOR_PROJECT_LEAD]: 'Subcontractor Project Lead',
    [EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR]:
        'Subcontractor Site Supervisor',
};

/** A contract role's label on a main contract or a subcontract. */
export function contractRoleLabel(role: string, isSubcontract: boolean): string {
    return (isSubcontract && SUBCONTRACT_ROLE_LABELS[role]) || role;
}

/** The role set of a party type. */
export function contractRoleSide(partyType: EPartyType): ContractRoleSide {
    return partyType === EPartyType.AWARDING ? 'client' : 'contractor';
}

/** The roles a party of this type may hold. */
export function contractRolesForParty(
    partyType: EPartyType,
): readonly ContractRole[] {
    return contractRoleSide(partyType) === 'client'
        ? CLIENT_CONTRACT_ROLES
        : CONTRACTOR_CONTRACT_ROLES;
}

/** Whether a value is a contract role of the party type's side. */
export function isContractRoleForParty(
    role: string,
    partyType: EPartyType,
): role is ContractRole {
    return (contractRolesForParty(partyType) as readonly string[]).includes(role);
}
/** A contract status recorded in status history: the contract statuses only. */
export enum EFromStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    DEFECTS_LIABILITY = 'defects_liability',
    COMPLETED = 'completed',
}
/** A contract status recorded in status history: the contract statuses only. */
export enum EToStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    DEFECTS_LIABILITY = 'defects_liability',
    COMPLETED = 'completed',
}
export enum EContractType{
    SERVICE= 'service',
    SUPPLY= 'supply',
    EPC= 'epc',
    MAINTENANCE= 'maintenance'
}
/**
 * A contract's status. Archiving is `deletedAt`, never a status.
 * DEFECTS_LIABILITY: the work is practically complete and only the
 * warranty, defects-liability and post-contract obligations stage is still
 * worked on, until the contract is completed.
 */
export enum EContractStatus{
    DRAFT= 'draft',
    ACTIVE= 'active',
    SUSPENDED= 'suspended',
    DEFECTS_LIABILITY= 'defects_liability',
    COMPLETED= 'completed'
}

/** Contract register columns the API accepts for `sortBy`. */
export enum EContractSortField {
  CREATED_AT = 'createdAt',
  REFERENCE_NUMBER = 'referenceNumber',
  TITLE = 'title',
  STATUS = 'status',
  START_DATE = 'startDate',
  END_DATE = 'endDate',
}

/**
 * A department of the Company Administrator's oversight: the contract
 * workspace it looks at. "Contractor" and "Client Project Mgmt" both open
 * the Project department, with a party-type filter.
 */
export enum ECompanyDepartment {
  PROJECT = 'project',
  HSE = 'hse',
  FINANCE = 'finance',
}

/**
 * What can hold a contract's progress on the department page. Version 1
 * uses only information a Company Administrator may already see; signals
 * from workspace content (milestones, invoices, incidents, compliance) are
 * deliberately absent.
 */
export enum EDepartmentBlockerType {
  SUSPENDED = 'suspended',
  DRAFT = 'draft',
  PARTY_INVITATION_PENDING = 'party_invitation_pending',
  ROLE_INVITATION_PENDING = 'role_invitation_pending',
  SIGNATORY_MISSING = 'signatory_missing',
  NO_WORKSPACE_ADMIN = 'no_workspace_admin',
  NO_MEMBERS = 'no_members',
  STALLED = 'stalled',
}

/** Orders of the department contract list. */
export enum EDepartmentContractSort {
  /** Contracts waiting on my company first, then the longest stalled. */
  WAITING_ON_US = 'waiting_on_us',
  /** The longest without movement first. */
  LONGEST_STALLED = 'longest_stalled',
  REFERENCE = 'reference',
  TITLE = 'title',
}
