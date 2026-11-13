import {
  IsNull,
  LessThanOrEqual,
  type EntityManager,
  type Repository,
} from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationStatus,
} from '@contractflow/contracts-schema';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyInvitation } from '../entities/company-invitation.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyAuditLog } from '../entities/company-audit-log.entity';
import type {
  ICompanyAdminCompanyWriter,
  ICompanyAdminInvitationWriter,
  ICompanyAdminMemberWriter,
  ICompanyAdminTransactionContext,
  ICompanyAdminUserReader,
  ICompanyAuditEntry,
  ICompanyAuditLogWriter,
  IInvitationPerson,
} from '../interface/company-admin-persistence.interface';
import type { ICompanyInvitationEntity } from '../interface/company-invitation.interface';
import type { ICompanyUserEntity } from '../interface/company-user.interface';

class CompanyAdminCompanyWriter implements ICompanyAdminCompanyWriter {
  constructor(private readonly repository: Repository<Company>) {}

  lockById(scope: ICompanyScope): Promise<Company | null> {
    return this.repository.findOne({
      where: { id: scope.companyId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  save(company: Company): Promise<Company> {
    return this.repository.save(company);
  }
}

class CompanyAdminMemberWriter implements ICompanyAdminMemberWriter {
  constructor(private readonly repository: Repository<CompanyUser>) {}

  lockActiveByUser(scope: ICompanyScope, userId: string) {
    return this.repository.findOne({
      where: {
        userId,
        companyId: scope.companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  lockActiveById(scope: ICompanyScope, membershipId: string) {
    return this.repository.findOne({
      where: {
        id: membershipId,
        companyId: scope.companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  lockAnyByUser(scope: ICompanyScope, userId: string) {
    return this.repository.findOne({
      where: { companyId: scope.companyId, userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findActiveByUser(scope: ICompanyScope, userId: string) {
    return this.repository.findOne({
      where: {
        companyId: scope.companyId,
        userId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
  }

  countActiveAdmins(scope: ICompanyScope): Promise<number> {
    return this.repository.count({
      where: {
        companyId: scope.companyId,
        companyRole: ECompanyRole.COMPANY_ADMIN,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
  }

  create(data: ICompanyUserEntity): Promise<CompanyUser> {
    return this.repository.save(this.repository.create(data));
  }

  save(member: CompanyUser): Promise<CompanyUser> {
    return this.repository.save(member);
  }
}

class CompanyAdminUserReader implements ICompanyAdminUserReader {
  constructor(
    private readonly repository: Repository<AppUser>,
    private readonly members: Repository<CompanyUser>,
  ) {}

  findIdByEmail(email: string) {
    return this.repository.findOne({
      where: { email },
      select: { id: true, email: true },
    });
  }

  findById(userId: string) {
    return this.repository.findOneBy({ id: userId });
  }

  async findActiveMemberPerson(
    scope: ICompanyScope,
    companyUserId: string,
  ): Promise<IInvitationPerson | null> {
    const membership = await this.members.findOne({
      where: {
        id: companyUserId,
        companyId: scope.companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      relations: { user: true },
    });
    if (!membership?.user) return null;
    const { email, firstName, lastName } = membership.user;
    return { email, firstName, lastName };
  }
}

class CompanyAuditLogWriter implements ICompanyAuditLogWriter {
  constructor(private readonly repository: Repository<CompanyAuditLog>) {}

  async append(entry: ICompanyAuditEntry): Promise<void> {
    // save, not insert: it runs the entity's @BeforeInsert ULID generation.
    await this.repository.save(this.repository.create(entry));
  }
}

class CompanyAdminInvitationWriter implements ICompanyAdminInvitationWriter {
  constructor(private readonly repository: Repository<CompanyInvitation>) {}

  findActivePendingByEmail(scope: ICompanyScope, email: string, now: Date) {
    return this.repository
      .createQueryBuilder('invitation')
      .where('invitation.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('invitation.email = :email', { email })
      .andWhere('invitation.status = :status', {
        status: EInvitationStatus.PENDING,
      })
      .andWhere('invitation.expiresAt > :now', { now })
      .getOne();
  }

  async expirePendingByEmail(
    scope: ICompanyScope,
    email: string,
    now: Date,
  ): Promise<void> {
    await this.repository.update(
      {
        companyId: scope.companyId,
        email,
        status: EInvitationStatus.PENDING,
        expiresAt: LessThanOrEqual(now),
      },
      { status: EInvitationStatus.EXPIRED },
    );
  }

  lockById(scope: ICompanyScope, invitationId: string) {
    return this.repository.findOne({
      where: { id: invitationId, companyId: scope.companyId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  lockByTokenHash(tokenHash: string) {
    return this.repository
      .createQueryBuilder('invitation')
      .addSelect('invitation.tokenHash')
      .where('invitation.tokenHash = :tokenHash', { tokenHash })
      .setLock('pessimistic_write')
      .getOne();
  }

  lockByIdForEmail(invitationId: string, email: string) {
    return this.repository
      .createQueryBuilder('invitation')
      .where('invitation.id = :invitationId', { invitationId })
      .andWhere('invitation.email = :email', { email })
      .setLock('pessimistic_write')
      .getOne();
  }

  findOtherActivePendingByEmail(
    scope: ICompanyScope,
    email: string,
    exceptInvitationId: string,
    now: Date,
  ) {
    return this.repository
      .createQueryBuilder('invitation')
      .where('invitation.companyId = :companyId', {
        companyId: scope.companyId,
      })
      .andWhere('invitation.email = :email', { email })
      .andWhere('invitation.id <> :exceptInvitationId', { exceptInvitationId })
      .andWhere('invitation.status = :status', {
        status: EInvitationStatus.PENDING,
      })
      .andWhere('invitation.expiresAt > :now', { now })
      .getOne();
  }

  create(data: ICompanyInvitationEntity): Promise<CompanyInvitation> {
    return this.repository.save(this.repository.create(data));
  }

  save(invitation: CompanyInvitation): Promise<CompanyInvitation> {
    return this.repository.save(invitation);
  }

  async revokePending(
    scope: ICompanyScope,
    invitationId: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const result = await this.repository.update(
      {
        id: invitationId,
        companyId: scope.companyId,
        status: EInvitationStatus.PENDING,
        revokedAt: IsNull(),
      },
      { status: EInvitationStatus.REVOKED, revokedAt },
    );
    return result.affected === 1;
  }
}

export class CompanyAdminTransactionContextFactory implements ITransactionContextFactory<ICompanyAdminTransactionContext> {
  create(manager: EntityManager): ICompanyAdminTransactionContext {
    return {
      companies: new CompanyAdminCompanyWriter(manager.getRepository(Company)),
      members: new CompanyAdminMemberWriter(manager.getRepository(CompanyUser)),
      users: new CompanyAdminUserReader(
        manager.getRepository(AppUser),
        manager.getRepository(CompanyUser),
      ),
      invitations: new CompanyAdminInvitationWriter(
        manager.getRepository(CompanyInvitation),
      ),
      auditLogs: new CompanyAuditLogWriter(
        manager.getRepository(CompanyAuditLog),
      ),
    };
  }
}
