import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../../../src/modules/contract/entities/contract-role-invitation.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { TypeOrmContractRoleAssignmentContext } from '../../../src/modules/contract/repositories/contract-role-assignment-transaction-context.factory';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ContractWorkspaceAccessService } from '../../../src/modules/contract/services/contract-workspace-access.service';
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
 * Company team invitations carry company membership only. Accepting one
 * makes the person a company member with the invited company role, and
 * nothing more: no contract role, no workspace, no contract access.
 */
describe('Company team invitations (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let service: CompanyAdminService;
  let workspaces: ContractWorkspaceAccessService;
  let access: ContractAccessService;
  let sentToken: string | undefined;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const companyUsers = new CompanyUserRepository(
      dataSource.getRepository(CompanyUser),
    );
    service = new CompanyAdminService(
      new CompanyScopeService(companyUsers),
      {
        sendCompanyInvitationEmail: async (
          _email: string,
          _company: string,
          _role: string,
          token: string,
        ) => {
          sentToken = token;
        },
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
    access = new ContractAccessService(
      companyUsers,
      new ContractPartyRepository(dataSource.getRepository(ContractParty)),
      new ContractRoleAssignmentRepository(
        dataSource.getRepository(ContractRoleAssignment),
      ),
      new ContractRepository(dataSource.getRepository(Contract)),
      new ContractWorkspaceRepository(
        dataSource.getRepository(ContractWorkspaceEntity),
        dataSource.getRepository(ContractParty),
      ),
    );
    workspaces = new ContractWorkspaceAccessService(
      access,
      new TypeOrmContractRoleAssignmentContext(dataSource.manager),
    );
  }, 60_000);

  afterEach(async () => {
    sentToken = undefined;
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await factory.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function invitee(): Promise<AppUser> {
    // A real account that belongs to some other company.
    const { member } = await factory.createCompanyMember(ECompanyRole.MEMBER);
    return dataSource
      .getRepository(AppUser)
      .findOneByOrFail({ id: member.userId });
  }

  it.each([ECompanyRole.MEMBER, ECompanyRole.COMPANY_ADMIN])(
    'accepting a %s invitation creates that membership and no contract access',
    async (companyRole) => {
      const { company, actor, contract } =
        await factory.createRoleAssignmentFixture();
      const user = await invitee();

      const invitation = await service.inviteMember(actor.userId, company.id, {
        email: user.email,
        firstName: 'Ada',
        lastName: 'Obi',
        companyRole,
      });
      expect(invitation.companyRole).toBe(companyRole);
      const stored = await dataSource
        .getRepository(CompanyInvitation)
        .findOneByOrFail({ id: invitation.id });
      expect(stored).toMatchObject({
        companyRole,
        firstName: 'Ada',
        lastName: 'Obi',
      });

      await expect(
        service.respondToInvitation(
          user.id,
          user.email,
          true,
          sentToken!,
          'accept',
        ),
      ).resolves.toEqual({ status: 'accepted' });

      const membership = await dataSource
        .getRepository(CompanyUser)
        .findOneByOrFail({ companyId: company.id, userId: user.id });
      expect(membership).toMatchObject({
        companyRole,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: null,
      });

      // No contract role, no contract-role invitation, no workspace.
      expect(
        await dataSource
          .getRepository(ContractRoleAssignment)
          .countBy({ companyUserId: membership.id }),
      ).toBe(0);
      expect(
        await dataSource
          .getRepository(ContractRoleInvitation)
          .countBy({ email: user.email }),
      ).toBe(0);
      if (companyRole === ECompanyRole.MEMBER) {
        // A new member cannot even see the company's contracts: company
        // membership alone grants no contract visibility.
        await expect(
          workspaces.listForUser(user.id, company.id, contract.id),
        ).rejects.toBeInstanceOf(NotFoundException);
        for (const workspace of ['general', 'project', 'hse', 'finance'] as const) {
          await expect(
            access.authorize(user.id, company.id, contract.id, workspace),
          ).rejects.toBeInstanceOf(NotFoundException);
        }
        await expect(
          access.authorizeContractOversight(user.id, company.id, contract.id),
        ).rejects.toBeInstanceOf(NotFoundException);
        return;
      }
      // A new Company Administrator gets read-only oversight, never a workspace.
      await expect(
        access.authorizeContractOversight(user.id, company.id, contract.id),
      ).resolves.toMatchObject({ basis: 'company_admin_oversight' });
      const summary = await workspaces.listForUser(
        user.id,
        company.id,
        contract.id,
      );
      expect(summary.workspaces.length).toBeGreaterThan(0);
      for (const workspace of summary.workspaces) {
        expect(workspace).toMatchObject({
          hasAccess: false,
          roles: [],
          isWorkspaceAdmin: false,
        });
      }
      for (const workspace of ['general', 'project', 'hse', 'finance'] as const) {
        await expect(
          access.authorize(user.id, company.id, contract.id, workspace),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    },
  );

  it('stores only Admin or Member as invitation roles in PostgreSQL', async () => {
    const { company, actor } = await factory.createRoleAssignmentFixture();
    const repository = dataSource.getRepository(CompanyInvitation);

    await expect(
      repository.insert({
        companyId: company.id,
        invitedByCompanyUserId: actor.id,
        email: 'legacy@integration.contractflow.test',
        firstName: null,
        lastName: null,
        companyRole: 'Finance Officer' as ECompanyRole,
        tokenHash: 'f'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
      }),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});
