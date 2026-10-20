import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ECompanyRole } from '@contractflow/contracts-schema';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { ContractPartyRepository } from '../repositories/contract-party.repository';

export type ContractWorkspace = 'project' | 'finance' | 'hse' | 'general';

const PROJECT_ROLES = [
  ECompanyRole.CONTRACTOR_PROJECT_LEAD,
  ECompanyRole.CONTRACTOR_SITE_SUPERVISOR,
  ECompanyRole.CLIENT_PROJECT_MANAGER,
  ECompanyRole.CLIENT_SITE_ENGINEER,
];
const FINANCE_ROLES = [
  ECompanyRole.FINANCE_OFFICER,
  ECompanyRole.FINANCE_DIRECTOR,
];
const HSE_ROLES = [ECompanyRole.HSE_OFFICER, ECompanyRole.HSE_MANAGER];

/**
 * Interim gate on the member's company role, because
 * ContractRoleAssignment.revokedAt is NOT NULL. Company Administrator is
 * deliberately in no list.
 */
const WORKSPACE_ROLES: Record<ContractWorkspace, ECompanyRole[]> = {
  project: PROJECT_ROLES,
  finance: FINANCE_ROLES,
  hse: HSE_ROLES,
  general: [...PROJECT_ROLES, ...FINANCE_ROLES, ...HSE_ROLES],
};

@Injectable()
export class ContractAccessService {
  constructor(
    private readonly companyUsers: CompanyUserRepository,
    private readonly parties: ContractPartyRepository,
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

    const parties = await this.parties.findForContract(contract, {
      companyId: company,
    });
    if (parties.length === 0) {
      throw new NotFoundException('Contract was not found');
    }

    if (!WORKSPACE_ROLES[workspace].includes(membership.companyRole)) {
      throw new ForbiddenException(
        'Your role does not have access to this contract workspace',
      );
    }
    return Object.freeze({ contractId: contract, companyId: company });
  }
}
