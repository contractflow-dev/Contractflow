import { ForbiddenException } from '@nestjs/common';
import {
  ECompanyMemberSortField,
  ECompanyRole,
  ECompanyUserStatus,
  ESortOrder,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import { CompanyInvitation } from '../../../src/modules/identity/entities/company-invitation.entity';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { Company } from '../../../src/modules/identity/entities/company.entity';
import { CompanyAdminReadRepository } from '../../../src/modules/identity/repositories/company-admin-read.repository';
import { CompanyAdminTransactionContextFactory } from '../../../src/modules/identity/repositories/company-admin-transaction-context.factory';
import { CompanyInvitationRepository } from '../../../src/modules/identity/repositories/company-invitation.repository';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { CompanyAdminService } from '../../../src/modules/identity/services/company/company-admin.service';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import type { CompanyVerificationService } from '../../../src/modules/identity/services/company/company-verification.service';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * The Team page's figures and member list come from one company's
 * memberships only, and only its Company Administrators can read them.
 */
describe('Company team management (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let service: CompanyAdminService;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    service = new CompanyAdminService(
      new CompanyScopeService(
        new CompanyUserRepository(dataSource.getRepository(CompanyUser)),
      ),
      {
        sendCompanyInvitationEmail: async () => undefined,
      } as unknown as MailService,
      new CompanyAdminReadRepository(
        dataSource.getRepository(CompanyUser),
        dataSource.getRepository(Company),
        new CompanyInvitationRepository(
          dataSource.getRepository(CompanyInvitation),
        ),
      ),
      new TypeOrmUnitOfWork(
        dataSource,
        new CompanyAdminTransactionContextFactory(),
      ),
      {} as unknown as CompanyVerificationService,
    );
  }, 60_000);

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await factory.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function rename(member: CompanyUser, lastName: string) {
    await dataSource
      .getRepository(AppUser)
      .update({ id: member.userId }, { firstName: 'Team', lastName });
  }

  /** A company with two admins, an ordinary member and a removed member. */
  async function teamFixture() {
    const { company, actor, target } =
      await factory.createRoleAssignmentFixture();
    const secondAdmin = await factory.createAdditionalMember(
      company,
      ECompanyRole.COMPANY_ADMIN,
    );
    const removed = await factory.createAdditionalMember(company);
    await dataSource
      .getRepository(CompanyUser)
      .update(
        { id: removed.id },
        { status: ECompanyUserStatus.INACTIVE, leftAt: new Date() },
      );
    await rename(actor, 'Carter');
    await rename(target, 'Adams');
    await rename(secondAdmin, 'Baker');
    await rename(removed, 'Dunn');

    // One live invitation and one that has expired.
    await service.inviteMember(actor.userId, company.id, {
      email: `pending-${Date.now()}@integration.contractflow.test`,
      companyRole: ECompanyRole.MEMBER,
    });
    const stale = await service.inviteMember(actor.userId, company.id, {
      email: `stale-${Date.now()}@integration.contractflow.test`,
      companyRole: ECompanyRole.MEMBER,
    });
    await dataSource
      .getRepository(CompanyInvitation)
      .update({ id: stale.id }, { expiresAt: new Date(Date.now() - 1000) });

    // Another company's people must never be counted or listed.
    const other = await factory.createCompanyMember(ECompanyRole.COMPANY_ADMIN);
    await factory.createAdditionalMember(other.company);
    await service.inviteMember(other.member.userId, other.company.id, {
      email: `elsewhere-${Date.now()}@integration.contractflow.test`,
      companyRole: ECompanyRole.MEMBER,
    });

    return { company, actor, target };
  }

  it('counts only this company: members, active, admins and live invitations', async () => {
    const { company, actor } = await teamFixture();

    await expect(
      service.getTeamSummary(actor.userId, company.id),
    ).resolves.toEqual({
      memberCount: 4,
      activeMemberCount: 3,
      companyAdminCount: 2,
      pendingInvitationCount: 1,
    });
  });

  it('filters members by company role and sorts them by name', async () => {
    const { company, actor } = await teamFixture();

    const admins = await service.listMembers(actor.userId, company.id, {
      companyRole: ECompanyRole.COMPANY_ADMIN,
      sortBy: ECompanyMemberSortField.NAME,
      sortOrder: ESortOrder.ASC,
      page: 1,
      limit: 20,
    });
    expect(admins.data.map((member) => member.lastName)).toEqual([
      'Baker',
      'Carter',
    ]);
    expect(admins.meta.totalItems).toBe(2);

    const everyoneByName = await service.listMembers(actor.userId, company.id, {
      sortBy: ECompanyMemberSortField.NAME,
      sortOrder: ESortOrder.DESC,
      page: 1,
      limit: 20,
    });
    expect(everyoneByName.data.map((member) => member.lastName)).toEqual([
      'Dunn',
      'Carter',
      'Baker',
      'Adams',
    ]);
  });

  it('refuses the team summary to a member who is not a Company Administrator', async () => {
    const { company, target } = await teamFixture();

    await expect(
      service.getTeamSummary(target.userId, company.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses another company's administrator", async () => {
    const { company } = await teamFixture();
    const outsider = await factory.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    );

    await expect(
      service.getTeamSummary(outsider.member.userId, company.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.listMembers(outsider.member.userId, company.id, {
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
