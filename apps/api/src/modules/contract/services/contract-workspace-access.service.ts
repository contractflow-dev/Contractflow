import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  type ContractWorkspaceAccess,
  type ContractWorkspaceAccessResponse,
  type ContractRole,
} from '@contractflow/contracts-schema';
import {
  CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE,
  type IContractRoleAssignmentRepositories,
  type IRoleAssignmentMember,
} from '../interfaces/contract-role-assignment-persistence.interface';
import { ContractAccessService } from './contract-access.service';
import {
  WORKSPACE_ROLES,
  type AssignableContractWorkspace,
} from './contract-workspace';

/** The order workspaces are listed in, wherever they appear. */
const WORKSPACE_ORDER: AssignableContractWorkspace[] = [
  'project',
  'hse',
  'finance',
];

type HeldRole = { role: ContractRole; isWorkspaceAdmin: boolean };

/**
 * The signed-in member's own standing in a contract's workspaces: which they
 * can enter, with which roles, and whether they manage the team. It reads only
 * the caller's own assignments, through the caller's company's party.
 *
 * Entering a workspace is decided by ContractAccessService.authorize, the same
 * check every workspace route uses. Company Administrator rights alone never
 * open a workspace: an explicit contract role is required.
 */
@Injectable()
export class ContractWorkspaceAccessService {
  constructor(
    private readonly access: ContractAccessService,
    @Inject(CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE)
    private readonly persistence: IContractRoleAssignmentRepositories,
  ) {}

  /**
   * Every workspace enabled on the contract, with the caller's access. The
   * contract must be visible to the caller and not archived: an ordinary
   * member needs a role on it (404 otherwise). A Company Administrator with
   * no role sees it through oversight and gets every `hasAccess: false`;
   * oversight never opens a workspace.
   */
  async listForUser(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractWorkspaceAccessResponse> {
    const { member, roles } = await this.memberRoles(
      userId,
      companyId,
      contractId,
    );
    const enabled = await this.persistence.workspaces.listEnabled(contractId);
    return {
      workspaces: WORKSPACE_ORDER.filter((workspace) =>
        enabled.includes(workspace),
      ).map((workspace) => summarize(workspace, roles, member)),
    };
  }

  /**
   * One workspace, for its landing screen. Refused exactly as any workspace
   * route is: 403 without a role in this workspace, 404 when the contract,
   * party or workspace isn't there.
   */
  async getForUser(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<ContractWorkspaceAccess> {
    await this.access.authorize(userId, companyId, contractId, workspace);
    const { member, roles } = await this.memberRoles(
      userId,
      companyId,
      contractId,
    );
    return summarize(workspace, roles, member);
  }

  private async memberRoles(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{ member: IRoleAssignmentMember; roles: HeldRole[] }> {
    // The same order of checks as ContractAccessService.
    const member = await this.persistence.memberships.findActiveMember(
      companyId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException('Active company membership is required');
    }
    const party = await this.persistence.parties.findByContractAndCompany(
      contractId,
      companyId,
    );
    if (!party || !(await this.persistence.contracts.findActive(contractId))) {
      throw new NotFoundException('Contract was not found');
    }
    const roles = await this.persistence.assignments.listActiveForMember(
      companyId,
      party.id,
      member.id,
    );
    // The same visibility rule as ContractAccessService: without a role here,
    // only a Company Administrator (oversight) may see the contract.
    if (roles.length === 0 && member.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new NotFoundException('Contract was not found');
    }
    return { member, roles };
  }
}

function summarize(
  workspace: AssignableContractWorkspace,
  roles: HeldRole[],
  member: IRoleAssignmentMember,
): ContractWorkspaceAccess {
  const held = roles.filter(({ role }) =>
    WORKSPACE_ROLES[workspace].includes(role),
  );
  const hasAccess = held.length > 0;
  const isWorkspaceAdmin = held.some((role) => role.isWorkspaceAdmin);
  return {
    workspace,
    hasAccess,
    roles: [...new Set(held.map(({ role }) => role))],
    isWorkspaceAdmin,
    canManageTeam:
      hasAccess &&
      (isWorkspaceAdmin || member.companyRole === ECompanyRole.COMPANY_ADMIN),
  };
}
