import { ForbiddenException, Injectable } from '@nestjs/common';
import { ECompanyStatus } from '@contractflow/contracts-schema';
import type { ICompanyScope } from '../../../../common/database/repositories/company-scope.interface';
import type { ICompanyRequestContext } from '../../interface/company-request-context.interface';
import { CompanyUserRepository } from '../../repositories/company-user.respository';

@Injectable()
export class CompanyScopeService {
  constructor(private readonly companyUsers: CompanyUserRepository) {}

  async forUser(userId: string, companyId: string): Promise<ICompanyScope> {
    const context = await this.contextForUser(userId, companyId);
    return Object.freeze({ companyId: context.companyId });
  }

  async contextForUser(
    userId: string,
    companyId: string,
  ): Promise<ICompanyRequestContext> {
    const normalizedCompanyId = companyId?.trim();
    if (!userId?.trim() || !normalizedCompanyId) {
      throw new ForbiddenException('Active company membership is required');
    }

    const membership = await this.companyUsers.findActiveMembershipWithCompany(
      userId,
      normalizedCompanyId,
    );

    if (
      !membership?.company ||
      membership.company.status !== ECompanyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Active company membership is required');
    }

    return Object.freeze({
      companyId: normalizedCompanyId,
      companyStatus: membership.company.status,
      membership: Object.freeze({
        id: membership.id,
        companyId: membership.companyId,
        companyRole: membership.companyRole,
        status: membership.status,
      }),
    });
  }
}
