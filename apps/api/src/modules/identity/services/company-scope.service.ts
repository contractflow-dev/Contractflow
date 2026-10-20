import { ForbiddenException, Injectable } from '@nestjs/common';
import { ECompanyUserStatus } from '@contractflow/contracts-schema';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyUser } from '../entities/company-user.entity';

@Injectable()
export class CompanyScopeService {
  constructor(
    @InjectRepository(CompanyUser)
    private readonly companyUsers: Repository<CompanyUser>,
  ) {}

  async forUser(userId: string, companyId: string): Promise<ICompanyScope> {
    const normalizedCompanyId = companyId?.trim();
    if (!userId?.trim() || !normalizedCompanyId) {
      throw new ForbiddenException('Active company membership is required');
    }

    const membership = await this.companyUsers.findOne({
      where: {
        userId,
        companyId: normalizedCompanyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('Active company membership is required');
    }

    return Object.freeze({ companyId: normalizedCompanyId });
  }
}
