import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ECompanyRole,
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
    scope: ICompanyScope,
    userId: string,
  ): Promise<CompanyUser | null> {
    return this.findOne(scope, {
      where: {
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
  }

  hasActiveMembershipForUser(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    return this.repository.exists({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
  }

  async findActiveRoleForUser(
    userId: string,
    companyId: string,
  ): Promise<CompanyUser['companyRole'] | null> {
    const membership = await this.repository.findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      select: { companyRole: true },
    });
    return membership?.companyRole ?? null;
  }

  findActiveMembershipsForUser(userId: string): Promise<CompanyUser[]> {
    return this.repository.find({
      where: {
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      order: { joinedAt: 'DESC' },
      relations: { company: true },
    });
  }

  findCurrentMembershipWithCompany(
    userId: string,
  ): Promise<CompanyUser | null> {
    return this.repository.findOne({
      where: {
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      order: { joinedAt: 'DESC' },
      relations: { company: true },
    });
  }

  findActiveMembershipWithCompany(
    userId: string,
    companyId: string,
  ): Promise<CompanyUser | null> {
    return this.repository.findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      relations: { company: true },
    });
  }

  findByRole(
    scope: ICompanyScope,
    companyRole: CompanyUser['companyRole'],
  ): Promise<CompanyUser[]> {
    return this.findAll(scope, { where: { companyRole } });
  }

  /** Guard against removing or demoting the last OWNER. */
  countActiveOwners(scope: ICompanyScope): Promise<number> {
    return this.activeMembersQuery(scope)
      .andWhere('e.companyRole = :role', { role: ECompanyRole.COMPANY_ADMIN })
      .getCount();
  }

  async countActiveMembers(companyId: string): Promise<number> {
    return this.repository.count({
      where: {
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
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
