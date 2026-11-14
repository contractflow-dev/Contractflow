import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ECompanyMemberSortField,
  ECompanyRole,
  type ECompanyStatus,
  ECompanyUserStatus,
  EInvitationStatus,
  ESortOrder,
} from '@contractflow/contracts-schema';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { Company } from '../entities/company.entity';
import type { CompanyInvitation } from '../entities/company-invitation.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { pageOffset } from '../../../common/application/pagination';
import type {
  IPageQuery,
  IPersistencePage,
} from '../../../common/application/pagination.interface';
import type {
  ICompanyAdminReadRepository,
  ICompanyMemberCounts,
  IInviteeInvitationRow,
  IListCompanyMembersCriteria,
} from '../interface/company-admin-persistence.interface';
import { CompanyInvitationRepository } from './company-invitation.repository';

@Injectable()
export class CompanyAdminReadRepository implements ICompanyAdminReadRepository {
  constructor(
    @InjectRepository(CompanyUser)
    private readonly members: Repository<CompanyUser>,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    private readonly invitations: CompanyInvitationRepository,
  ) {}

  async findActiveRole(
    scope: ICompanyScope,
    userId: string,
  ): Promise<ECompanyRole | null> {
    const membership = await this.members.findOne({
      where: {
        userId,
        companyId: scope.companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      select: { id: true, companyRole: true },
    });
    return membership?.companyRole ?? null;
  }

  async listMembers(
    scope: ICompanyScope,
    criteria: IListCompanyMembersCriteria,
  ): Promise<IPersistencePage<CompanyUser>> {
    const builder = this.members
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.companyId = :companyId', {
        companyId: scope.companyId,
      });

    if (criteria.status) {
      builder.andWhere('membership.status = :status', {
        status: criteria.status,
      });
    }

    if (criteria.companyRole) {
      builder.andWhere('membership.companyRole = :companyRole', {
        companyRole: criteria.companyRole,
      });
    }

    if (criteria.search) {
      const search = criteria.search.replace(/[\\%_]/g, '\\$&');
      builder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Only known fields reach ORDER BY. `id` breaks ties so rows that
    // compare equal keep their page.
    const order = criteria.sortOrder === ESortOrder.ASC ? 'ASC' : 'DESC';
    if (criteria.sortBy === ECompanyMemberSortField.NAME) {
      builder
        .orderBy('user.lastName', order)
        .addOrderBy('user.firstName', order);
    } else {
      builder.orderBy('membership.joinedAt', order);
    }
    const [items, total] = await builder
      .addOrderBy('membership.id', 'ASC')
      .skip(pageOffset(criteria))
      .take(criteria.limit)
      .getManyAndCount();
    return { items, total };
  }

  listInvitations(
    scope: ICompanyScope,
    query: IPageQuery,
  ): Promise<IPersistencePage<CompanyInvitation>> {
    return this.invitations.findPage(scope, {
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: pageOffset(query),
      take: query.limit,
    });
  }

  findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<CompanyInvitation | null> {
    return this.invitations.findByTokenHashUnscoped(tokenHash);
  }

  async expireInvitation(
    scope: ICompanyScope,
    invitationId: string,
  ): Promise<void> {
    await this.invitations.update(scope, invitationId, {
      status: EInvitationStatus.EXPIRED,
    });
  }

  findCompanyName(
    companyId: string,
  ): Promise<{ id: string; name: string; status: ECompanyStatus } | null> {
    return this.companies.findOne({
      where: { id: companyId },
      select: { id: true, name: true, status: true },
    });
  }

  async countMembers(scope: ICompanyScope): Promise<ICompanyMemberCounts> {
    const row = await this.members
      .createQueryBuilder('membership')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE membership.status = :active AND membership.leftAt IS NULL)::int',
        'active',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE membership.status = :active AND membership.leftAt IS NULL AND membership.companyRole = :admin)::int',
        'activeAdmins',
      )
      .where('membership.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .setParameters({
        active: ECompanyUserStatus.ACTIVE,
        admin: ECompanyRole.COMPANY_ADMIN,
      })
      .getRawOne<{ total: number; active: number; activeAdmins: number }>();
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      activeAdmins: Number(row?.activeAdmins ?? 0),
    };
  }

  countPendingInvitations(scope: ICompanyScope, at: Date): Promise<number> {
    return this.invitations.countPending(scope, at);
  }

  async findMemberName(companyUserId: string): Promise<string | null> {
    const membership = await this.members.findOne({
      where: { id: companyUserId },
      relations: { user: true },
    });
    return membership?.user ? fullName(membership.user) : null;
  }

  async listPendingInvitationsForEmail(
    email: string,
    at: Date,
  ): Promise<IInviteeInvitationRow[]> {
    const invitations = await this.invitations.findPendingForEmailUnscoped(
      email,
      at,
    );
    return invitations.map((invitation) => ({
      invitation,
      companyName: invitation.company.name,
      inviterName: invitation.CompanyUser?.user
        ? fullName(invitation.CompanyUser.user)
        : null,
    }));
  }
}

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
