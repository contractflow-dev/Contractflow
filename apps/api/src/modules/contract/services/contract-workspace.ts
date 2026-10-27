import { EContractRole, EPartyType } from '@contractflow/contracts-schema';

export type ContractWorkspace = 'project' | 'finance' | 'hse' | 'general';
export type AssignableContractWorkspace = Exclude<ContractWorkspace, 'general'>;

export const WORKSPACE_ROLES: Record<ContractWorkspace, EContractRole[]> = {
  project: [
    EContractRole.CONTRACTOR_PROJECT_LEAD,
    EContractRole.CONTRACTOR_SITE_SUPERVISOR,
    EContractRole.CLIENT_PROJECT_MANAGER,
    EContractRole.CLIENT_SITE_ENGINEER,
  ],
  finance: [EContractRole.FINANCE_OFFICER, EContractRole.FINANCE_DIRECTOR],
  hse: [EContractRole.HSE_OFFICER, EContractRole.HSE_MANAGER],
  general: Object.values(EContractRole),
};

const ROLE_PARTY_TYPES: Partial<Record<EContractRole, EPartyType[]>> = {
  [EContractRole.CONTRACTOR_PROJECT_LEAD]: [
    EPartyType.CONTRACTOR,
    EPartyType.SUBCONTRACTOR,
  ],
  [EContractRole.CONTRACTOR_SITE_SUPERVISOR]: [
    EPartyType.CONTRACTOR,
    EPartyType.SUBCONTRACTOR,
  ],
  [EContractRole.CLIENT_PROJECT_MANAGER]: [EPartyType.CLIENT],
  [EContractRole.CLIENT_SITE_ENGINEER]: [EPartyType.CLIENT],
};

export function workspaceForRole(
  role: EContractRole,
): AssignableContractWorkspace {
  if (WORKSPACE_ROLES.project.includes(role)) return 'project';
  if (WORKSPACE_ROLES.finance.includes(role)) return 'finance';
  if (WORKSPACE_ROLES.hse.includes(role)) return 'hse';
  throw new Error(`Contract role "${role}" has no workspace mapping.`);
}

export function roleAllowedForParty(
  role: EContractRole,
  partyType: EPartyType,
): boolean {
  const partyTypes = ROLE_PARTY_TYPES[role];
  return !partyTypes || partyTypes.includes(partyType);
}
