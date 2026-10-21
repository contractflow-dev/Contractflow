import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';

@Injectable()
export class CompanyUserRepository extends CompanyScopedRepository<
  CompanyUser,
  ICompanyScope
> {
  constructor(
    @InjectRepository(CompanyUser) repository: Repository<CompanyUser>,
  ) {
    super(repository);
  }

  /** The user's current membership of the scoped company, or null. */
  findActiveMember(
    userId: string,
    scope: ICompanyScope,
  ): Promise<CompanyUser | null> {
    return this.findOne(
      {
        where: {
          userId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
      },
      scope,
    );
  }

  findByRole(
    companyRole: CompanyUser['companyRole'],
    scope: ICompanyScope,
  ): Promise<CompanyUser[]> {
    return this.findAll(scope, { where: { companyRole } });
  }

  /** Guard against removing or demoting the last OWNER. */
  countActiveOwners(scope: ICompanyScope): Promise<number> {
    return this.activeMembersQuery(scope)
      .andWhere('e.companyRole = :role', { role: ECompanyRole.COMPANY_ADMIN })
      .getCount();
  }

  /**
   * Single definition of "active" for query-builder queries, kept in line
   * with findActiveMember (status ACTIVE and not left).
   * Assumes scopedQuery() aliases the entity as `e`.
   */
  private activeMembersQuery(scope: ICompanyScope) {
    return this.scopedQuery(scope).andWhere(
      'e.status = :activeStatus AND e.leftAt IS NULL',
      { activeStatus: ECompanyUserStatus.ACTIVE },
    );
  }
}
