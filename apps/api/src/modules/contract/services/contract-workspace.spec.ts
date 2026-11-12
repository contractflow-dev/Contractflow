import {
  CLIENT_CONTRACT_ROLES,
  CONTRACTOR_CONTRACT_ROLES,
  CONTRACT_ROLES,
  EClientContractRole,
  EContractorContractRole,
  EPartyType,
  contractRoleSide,
  contractRolesForParty,
} from '@contractflow/contracts-schema';
import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_ROLES,
  roleAllowedForParty,
  workspaceForRole,
} from './contract-workspace';

// The labels of contract_role_assignment_contract_role_enum and
// contract_role_invitation_contract_role_enum, in database order.
const STORED_LABELS = [
  'Contractor Project Lead',
  'Contractor Site Supervisor',
  'Client Project Manager',
  'Client Site Engineer',
  'HSE Officer',
  'HSE Manager',
  'Finance Officer',
  'Finance Director',
];

describe('client and contractor contract roles', () => {
  it('keep the stored values, so no contract-role data changes', () => {
    expect([...CONTRACT_ROLES]).toEqual(STORED_LABELS);
  });

  it('give each side its own project roles and share HSE and Finance values', () => {
    expect(CLIENT_CONTRACT_ROLES).toEqual([
      'Client Project Manager',
      'Client Site Engineer',
      'HSE Officer',
      'HSE Manager',
      'Finance Officer',
      'Finance Director',
    ]);
    expect(CONTRACTOR_CONTRACT_ROLES).toEqual([
      'Contractor Project Lead',
      'Contractor Site Supervisor',
      'HSE Officer',
      'HSE Manager',
      'Finance Officer',
      'Finance Director',
    ]);
    expect(EClientContractRole.HSE_OFFICER).toBe(
      EContractorContractRole.HSE_OFFICER,
    );
    expect(EClientContractRole.FINANCE_DIRECTOR).toBe(
      EContractorContractRole.FINANCE_DIRECTOR,
    );
  });

  it.each([
    [EPartyType.CLIENT, 'client'],
    [EPartyType.CONTRACTOR, 'contractor'],
    [EPartyType.SUBCONTRACTOR, 'contractor'],
    [EPartyType.VENDOR, 'contractor'],
    [EPartyType.OTHER, 'contractor'],
  ] as const)('puts a %s party on the %s side', (partyType, side) => {
    expect(contractRoleSide(partyType)).toBe(side);
    expect(contractRolesForParty(partyType)).toBe(
      side === 'client' ? CLIENT_CONTRACT_ROLES : CONTRACTOR_CONTRACT_ROLES,
    );
  });

  it('allows a role only on its own side', () => {
    expect(
      roleAllowedForParty(
        EClientContractRole.CLIENT_PROJECT_MANAGER,
        EPartyType.CLIENT,
      ),
    ).toBe(true);
    expect(
      roleAllowedForParty(
        EClientContractRole.CLIENT_PROJECT_MANAGER,
        EPartyType.CONTRACTOR,
      ),
    ).toBe(false);
    expect(
      roleAllowedForParty(
        EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
        EPartyType.CLIENT,
      ),
    ).toBe(false);
    expect(
      roleAllowedForParty(
        EContractorContractRole.CONTRACTOR_SITE_SUPERVISOR,
        EPartyType.VENDOR,
      ),
    ).toBe(true);
    for (const partyType of Object.values(EPartyType)) {
      expect(
        roleAllowedForParty(EClientContractRole.HSE_MANAGER, partyType),
      ).toBe(true);
      expect(
        roleAllowedForParty(EContractorContractRole.FINANCE_OFFICER, partyType),
      ).toBe(true);
    }
  });

  it('maps every role to exactly one workspace', () => {
    for (const role of CONTRACT_ROLES) {
      const workspaces = (['project', 'hse', 'finance'] as const).filter(
        (workspace) => WORKSPACE_ROLES[workspace].includes(role),
      );
      expect(workspaces).toEqual([workspaceForRole(role)]);
    }
    expect([...WORKSPACE_ROLES.general].sort()).toEqual(
      [...STORED_LABELS].sort(),
    );
  });
});
