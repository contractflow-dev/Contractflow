import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { Contract } from '../entities/contract.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractPartyRepository } from '../repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../repositories/contract-role-assignment.repository';
import { WORKSPACE_ROLES, type ContractWorkspace } from './contract-workspace';

export type { ContractWorkspace } from './contract-workspace';

@Injectable()
export class ContractAccessService {
  constructor(
    private readonly companyUsers: CompanyUserRepository,
    private readonly parties: ContractPartyRepository,
    private readonly roleAssignments: ContractRoleAssignmentRepository,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(ContractWorkspaceEntity)
    private readonly workspaces: Repository<ContractWorkspaceEntity>,
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

    const membership = await this.companyUsers.findActiveMember(user, {
      companyId: company,
    });
    if (!membership) {
      throw new ForbiddenException('Active company membership is required');
    }

    const party = await this.parties.findByCompany(company, {
      contractId: contract,
      companyId: company,
    });
    if (!party) {
      throw new NotFoundException('Contract was not found');
    }
    const contractRecord = await this.contracts.findOne({
      where: { id: contract, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!contractRecord) {
      throw new NotFoundException('Contract was not found');
    }
    if (workspace !== 'general') {
      const workspaceRecord = await this.workspaces.findOne({
        where: { contractId: contract, workspace },
        select: { contractId: true },
      });
      if (!workspaceRecord) {
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
