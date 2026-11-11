import {
  CONTRACT_ROLES,
  EClientContractRole,
  EContractorContractRole,
  isContractRoleForParty,
  type ContractRole,
  type EPartyType,
} from '@contractflow/contracts-schema';
import type { AssignableContractWorkspace } from '@contractflow/contracts-schema';

export type { AssignableContractWorkspace } from '@contractflow/contracts-schema';

export type ContractWorkspace = AssignableContractWorkspace | 'general';

/**
 * The stored role values of each workspace. HSE and Finance values are the
 * same on both sides; which side a holder is on comes from their party.
 */
export const WORKSPACE_ROLES: Record<ContractWorkspace, ContractRole[]> = {
  project: [
    EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
    EClientContractRole.CLIENT_PROJECT_MANAGER,
    EClientContractRole.CLIENT_SITE_ENGINEER,
  ],
  finance: [
    EClientContractRole.FINANCE_OFFICER,
    EClientContractRole.FINANCE_DIRECTOR,
  ],
  hse: [EClientContractRole.HSE_OFFICER, EClientContractRole.HSE_MANAGER],
  general: [...CONTRACT_ROLES],
};

export function workspaceForRole(
  role: ContractRole,
): AssignableContractWorkspace {
  if (WORKSPACE_ROLES.project.includes(role)) return 'project';
  if (WORKSPACE_ROLES.finance.includes(role)) return 'finance';
  if (WORKSPACE_ROLES.hse.includes(role)) return 'hse';
  throw new Error(`Contract role "${role}" has no workspace mapping.`);
}

/**
 * Whether the role belongs to the party's side: client roles for a CLIENT
 * party, contractor roles for CONTRACTOR, SUBCONTRACTOR, VENDOR and OTHER.
 */
export function roleAllowedForParty(
  role: ContractRole,
  partyType: EPartyType,
): boolean {
  return isContractRoleForParty(role, partyType);
}
