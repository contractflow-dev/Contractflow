import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { ContractRepository } from '../repositories/contract.repository';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../repositories/contract-workspace.repository';
import { WORKSPACE_ROLES, type ContractWorkspace } from './contract-workspace';

@Injectable()
export class ContractAccessService {
  constructor(
    private readonly companyUsers: CompanyUserRepository,
    private readonly parties: ContractPartyRepository,
    private readonly roleAssignments: ContractRoleAssignmentRepository,
    private readonly contracts: ContractRepository,
    private readonly workspaces: ContractWorkspaceRepository,
  ) {}

  async authorize(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: ContractWorkspace,
  ): Promise<IContractCompanyScope> {
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
      throw new NotFoundException('Contract was not found');
    }
    const contractRecord = await this.contracts.findById(
      { companyId: company },
      contract,
    );
    if (!contractRecord) {
      throw new NotFoundException('Contract was not found');
    }
    if (workspace !== 'general') {
      const workspaceExists = await this.workspaces.exists(
        { contractId: contract, companyId: company },
        workspace,
      );
      if (!workspaceExists) {
        throw new ForbiddenException('This contract workspace is unavailable');
      }
    }

    const assignments = await this.roleAssignments.findActiveByCompanyUser(
      membership.id,
      { companyId: company },
    );
    const hasWorkspaceRole = assignments.some(
      ({ contractPartyId, role }) =>
        contractPartyId === party.id &&
        WORKSPACE_ROLES[workspace].includes(role),
    );
    if (!hasWorkspaceRole) {
      throw new ForbiddenException(
        'Your role does not have access to this contract workspace',
      );
    }
    return Object.freeze({ contractId: contract, companyId: company });
  }
}
