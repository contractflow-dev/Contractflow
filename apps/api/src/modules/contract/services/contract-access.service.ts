import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ECompanyRole } from '@contractflow/contracts-schema';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import type { CompanyUser } from '../../identity/entities/company-user.entity';
import type { Contract } from '../entities/contract.entity';
import type { ContractParty } from '../entities/contract-party.entity';
import type { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRepository } from '../repositories/contract.repository';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../repositories/contract-workspace.repository';
import { WORKSPACE_ROLES, type ContractWorkspace } from './contract-workspace';

/**
 * Why a contract is visible to its reader:
 * - `assignment`: an active role assignment on the reader's party.
 * - `company_admin_oversight`: the reader is a Company Administrator of a
 *   party company and holds no role on it. Read-only oversight of contract
 *   detail, parties and status history only.
 */
export type ContractVisibilityBasis = 'assignment' | 'company_admin_oversight';

/** The result of `authorizeContractOversight`. Internal; never serialized. */
export interface IContractOversightAuthorization {
  scope: IContractCompanyScope;
  basis: ContractVisibilityBasis;
  /** The reader's company's party row on this contract. */
  party: ContractParty;
  contract: Contract;
  /** The reader is an active Company Administrator of the header company. */
  isCompanyAdmin: boolean;
}

function contractNotFound(): NotFoundException {
  return new NotFoundException('Contract was not found');
}

/**
 * The one place contract access is decided. It has two deliberately separate
 * entry points:
 *
 * - `authorizeContractOversight` lets a contract be *seen*: its detail,
 *   parties and status history. An active role assignment satisfies it, and
 *   so does Company Administrator oversight.
 * - `authorize` / `authorizeIncludingArchived` open protected contract
 *   resources (activity, documents, delivery, finance, HSE, site operations)
 *   and workspaces. They always require an active role assignment for the
 *   requested workspace. Company Administrator oversight never satisfies them.
 *
 * Both answer 404 when the contract is not visible to the reader at all, so a
 * contract's existence is not revealed. `authorize` answers 403 when the
 * contract is visible but the workspace or resource is not.
 */
@Injectable()
export class ContractAccessService {
  constructor(
    private readonly companyUsers: CompanyUserRepository,
    private readonly parties: ContractPartyRepository,
    private readonly roleAssignments: ContractRoleAssignmentRepository,
    private readonly contracts: ContractRepository,
    private readonly workspaces: ContractWorkspaceRepository,
  ) {}

  /**
   * Read-only contract visibility: an active role on this contract, or
   * Company Administrator oversight of a contract the company is party to.
   * Use it ONLY for contract detail, parties, status history and other
   * general contract information. Never use its result to open a workspace or
   * a protected contract resource; use `authorize` for those.
   */
  async authorizeContractOversight(
    userId: string,
    companyId: string,
    contractId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<IContractOversightAuthorization> {
    const { membership, party, assignments, contractId: id, companyId: co } =
      await this.resolveReader(userId, companyId, contractId);
    const hasAssignment = assignments.length > 0;
    const isCompanyAdmin = membership.companyRole === ECompanyRole.COMPANY_ADMIN;
    if (!hasAssignment && !isCompanyAdmin) {
      throw contractNotFound();
    }
    const contract = await this.findVisibleContract(
      co,
      membership,
      id,
      true,
      options.includeArchived ?? false,
    );
    return {
      scope: Object.freeze({ contractId: id, companyId: co }),
      basis: hasAssignment ? 'assignment' : 'company_admin_oversight',
      party,
      contract,
      isCompanyAdmin,
    };
  }

  async authorize(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: ContractWorkspace,
  ): Promise<IContractCompanyScope> {
    const { scope } = await this.check(
      userId,
      companyId,
      contractId,
      workspace,
      false,
    );
    return scope;
  }

  /**
   * The same checks as `authorize`, but an archived contract is allowed and
   * reported, so a caller can keep its records readable while refusing
   * changes. Only callers that enforce that read-only rule may use this.
   */
  async authorizeIncludingArchived(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: ContractWorkspace,
  ): Promise<{ scope: IContractCompanyScope; archived: boolean }> {
    return this.check(userId, companyId, contractId, workspace, true);
  }

  private async check(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: ContractWorkspace,
    includeArchived: boolean,
  ): Promise<{ scope: IContractCompanyScope; archived: boolean }> {
    const { membership, assignments, contractId: id, companyId: co } =
      await this.resolveReader(userId, companyId, contractId);
    const isCompanyAdmin = membership.companyRole === ECompanyRole.COMPANY_ADMIN;
    // No role on this contract at all: an ordinary member can't even see it.
    // A Company Administrator can (oversight), so they get the 403 below.
    if (assignments.length === 0 && !isCompanyAdmin) {
      throw contractNotFound();
    }
    // Oversight is consulted here ONLY to tell 404 from 403. It never grants:
    // the workspace role check below still decides access.
    const contractRecord = await this.findVisibleContract(
      co,
      membership,
      id,
      isCompanyAdmin,
      includeArchived,
    );
    if (workspace !== 'general') {
      const workspaceExists = await this.workspaces.exists(
        { contractId: id, companyId: co },
        workspace,
      );
      if (!workspaceExists) {
        throw new ForbiddenException('This contract workspace is unavailable');
      }
    }

    const hasWorkspaceRole = assignments.some(({ role }) =>
      WORKSPACE_ROLES[workspace].includes(role),
    );
    if (!hasWorkspaceRole) {
      throw new ForbiddenException(
        'Your role does not have access to this contract workspace',
      );
    }
    return {
      scope: Object.freeze({ contractId: id, companyId: co }),
      archived: contractRecord.deletedAt !== null,
    };
  }

  /**
   * The reader's active membership, their company's party row, and their
   * active assignments on that party (and only that party).
   */
  private async resolveReader(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{
    membership: CompanyUser;
    party: ContractParty;
    assignments: ContractRoleAssignment[];
    contractId: string;
    companyId: string;
  }> {
    const user = userId?.trim();
    const company = companyId?.trim();
    const contract = contractId?.trim();
    if (!user || !company || !contract) {
      throw new ForbiddenException('Active company membership is required');
    }

    const membership = await this.companyUsers.findActiveMember(
      { companyId: company },
      user,
    );
    if (!membership) {
      throw new ForbiddenException('Active company membership is required');
    }

    const party = await this.parties.findByCompany(
      { contractId: contract, companyId: company },
      company,
    );
    if (!party) {
      throw contractNotFound();
    }
    const assignments = (
      await this.roleAssignments.findActiveByCompanyUser(membership.id, {
        companyId: company,
      })
    ).filter(({ contractPartyId }) => contractPartyId === party.id);
    return {
      membership,
      party,
      assignments,
      contractId: contract,
      companyId: company,
    };
  }

  /** The contract, re-checked in SQL under the reader's visibility rule. */
  private async findVisibleContract(
    companyId: string,
    membership: CompanyUser,
    contractId: string,
    includeCompanyAdminOversight: boolean,
    includeArchived: boolean,
  ): Promise<Contract> {
    const scope = {
      companyId,
      companyUserId: membership.id,
      includeCompanyAdminOversight,
    };
    const contract = includeArchived
      ? await this.contracts.findByIdIncludingArchived(scope, contractId)
      : await this.contracts.findById(scope, contractId);
    if (!contract) {
      throw contractNotFound();
    }
    return contract;
  }
}
