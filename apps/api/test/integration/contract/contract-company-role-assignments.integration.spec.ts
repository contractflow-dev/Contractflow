import { ForbiddenException } from '@nestjs/common';
import { ECompanyRole, EContractRole } from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import type { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import {
  ContractRoleAssignmentTransactionContextFactory,
  TypeOrmContractRoleAssignmentContext,
} from '../../../src/modules/contract/repositories/contract-role-assignment-transaction-context.factory';
import { ContractRoleAssignmentService } from '../../../src/modules/contract/services/contract-role-assignment.service';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * The company-wide list of contract roles ("Can view every role assignment
 * at my company"): one company's active roles, never another's, for its
 * Company Administrators only.
 */
describe('Company-wide contract roles (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let service: ContractRoleAssignmentService;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    service = new ContractRoleAssignmentService(
      new TypeOrmContractRoleAssignmentContext(dataSource.manager),
      new TypeOrmUnitOfWork(
        dataSource,
        new ContractRoleAssignmentTransactionContextFactory(),
      ),
      {
        sendContractRoleInvitationEmail: async () => undefined,
      } as unknown as MailService,
    );
  }, 60_000);

  afterEach(async () => {
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function assign(
    party: ContractParty,
    member: CompanyUser,
    role: EContractRole,
    options: { admin?: boolean; revoked?: boolean } = {},
  ): Promise<ContractRoleAssignment> {
    const repository = dataSource!.getRepository(ContractRoleAssignment);
    return repository.save(
      repository.create({
        contractPartyId: party.id,
        companyUserId: member.id,
        companyId: member.companyId,
        role,
        isWorkspaceAdmin: options.admin ?? false,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: options.revoked ? new Date() : null,
        revokedById: options.revoked ? member.id : null,
      }),
    );
  }

  async function scenario() {
    const {
      company,
      actor: admin,
      target: member,
      contract,
      party,
    } = await factory!.createRoleAssignmentFixture();
    const finance = await assign(party, member, EContractRole.FINANCE_OFFICER, {
      admin: true,
    });
    await assign(party, member, EContractRole.CLIENT_PROJECT_MANAGER, {
      revoked: true,
    });

    const second = await factory!.createAdditionalContract(company);
    const secondParty = await factory!.createAdditionalParty(second, company);
    const hse = await assign(secondParty, member, EContractRole.HSE_OFFICER);

    const archived = await factory!.createAdditionalContract(company);
    const archivedParty = await factory!.createAdditionalParty(
      archived,
      company,
    );
    await assign(archivedParty, member, EContractRole.HSE_MANAGER);
    await dataSource!
      .getRepository(Contract)
      .update({ id: archived.id }, { deletedAt: new Date() });

    // Another company on the same contract, with its own member's role.
    const { company: other, member: otherAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN);
    const otherParty = await factory!.createAdditionalParty(contract, other);
    const otherMember = await factory!.createAdditionalMember(other);
    const otherRole = await assign(
      otherParty,
      otherMember,
      EContractRole.CONTRACTOR_PROJECT_LEAD,
    );

    return {
      company,
      admin,
      member,
      contract,
      second,
      finance,
      hse,
      otherAdmin,
      otherRole,
    };
  }

  const page = { page: 1, limit: 20 };

  it("lists the company's active roles on live contracts, and nobody else's", async () => {
    const { company, admin, member, contract, finance, hse, otherRole } =
      await scenario();

    const result = await service.listForCompany(admin.userId, company.id, page);

    expect(result.meta.totalItems).toBe(2);
    expect(result.data.map(({ id }) => id).sort()).toEqual(
      [finance.id, hse.id].sort(),
    );
    expect(result.data.map(({ id }) => id)).not.toContain(otherRole.id);
    expect(result.data.find(({ id }) => id === finance.id)).toMatchObject({
      contractId: contract.id,
      contractReference: contract.referenceNumber,
      contractTitle: contract.title,
      companyUserId: member.id,
      role: EContractRole.FINANCE_OFFICER,
      workspace: 'finance',
      isWorkspaceAdmin: true,
    });
  });

  it('shows the other company only its own roles on the shared contract', async () => {
    const { otherAdmin, otherRole } = await scenario();

    const result = await service.listForCompany(
      otherAdmin.userId,
      otherAdmin.companyId,
      page,
    );
    expect(result.data.map(({ id }) => id)).toEqual([otherRole.id]);
  });

  it('narrows by workspace and by member, and pages', async () => {
    const { company, admin, member, hse } = await scenario();

    const hseOnly = await service.listForCompany(admin.userId, company.id, {
      ...page,
      workspace: 'hse',
    });
    expect(hseOnly.data.map(({ id }) => id)).toEqual([hse.id]);

    const byAdmin = await service.listForCompany(admin.userId, company.id, {
      ...page,
      companyUserId: admin.id,
    });
    expect(byAdmin.data).toEqual([]);

    const byMember = await service.listForCompany(admin.userId, company.id, {
      page: 2,
      limit: 1,
      companyUserId: member.id,
    });
    expect(byMember.meta).toMatchObject({ totalItems: 2, currentPage: 2 });
    expect(byMember.data).toHaveLength(1);
  });

  it('is for Company Administrators of the header company only', async () => {
    const { company, member, otherAdmin } = await scenario();

    await expect(
      service.listForCompany(member.userId, company.id, page),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // An administrator of another company, sending this company's header.
    await expect(
      service.listForCompany(otherAdmin.userId, company.id, page),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
