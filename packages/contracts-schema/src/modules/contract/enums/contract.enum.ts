
export enum EPartyType {
  CLIENT = 'client',
  CONTRACTOR = 'contractor',
  SUBCONTRACTOR = 'subcontractor',
  VENDOR = 'vendor',
  OTHER = 'other',
}

/**
 * Contract roles held through a CLIENT party. HSE and Finance roles share
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

/**
 * Contract roles held through a contractor-side party: CONTRACTOR,
 * SUBCONTRACTOR, VENDOR or OTHER.
 */
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

/** Which role set a party uses. */
export type ContractRoleSide = 'client' | 'contractor';

/**
 * The role set of a party type: CLIENT uses the client roles; CONTRACTOR,
 * SUBCONTRACTOR, VENDOR and OTHER use the contractor roles.
 */
export function contractRoleSide(partyType: EPartyType): ContractRoleSide {
    return partyType === EPartyType.CLIENT ? 'client' : 'contractor';
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
export enum EFromStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum EToStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    UNDER_REVIEW = 'under_review'
}
export enum EContractType{
    SERVICE= 'service', 
    SUPPLY= 'supply', 
    EPC= 'epc', 
    MAINTENANCE= 'maintenance'
}
export enum EContractStatus{
    DRAFT= 'draft', 
    ACTIVE= 'active', 
    SUSPENDED= 'suspended', 
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
