import {
  ECompanyRole,
  EContractorContractRole,
  type ContractRole,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import type { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * "My contracts" lists only contracts the signed-in member holds an active
 * role on, inside the header company. Checked against PostgreSQL.
 */
describe('Contracts assigned to me (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let contracts: ContractRepository;
  let assignments: ContractRoleAssignmentRepository;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    contracts = new ContractRepository(dataSource.getRepository(Contract));
    assignments = new ContractRoleAssignmentRepository(
      dataSource.getRepository(ContractRoleAssignment),
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
    role: ContractRole,
    revoked = false,
  ) {
    const repository = dataSource!.getRepository(ContractRoleAssignment);
    await repository.save(
      repository.create({
        contractPartyId: party.id,
        companyUserId: member.id,
        companyId: member.companyId,
        role,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: revoked ? new Date() : null,
        revokedById: revoked ? member.id : null,
      }),
    );
  }

  it('narrows the company contracts to the member’s active assignments', async () => {
    // The member holds an active Project Lead role on `assigned`.
    const { company, actor, contract: assigned } =
      await factory!.createLifecycleFixture();
    const colleague = await factory!.createAdditionalMember(company);

    const unassigned = await factory!.createAdditionalContract(company);
    await factory!.createAdditionalParty(unassigned, company);

    const revoked = await factory!.createAdditionalContract(company);
    const revokedParty = await factory!.createAdditionalParty(revoked, company);
    await assign(revokedParty, actor, EContractorContractRole.FINANCE_OFFICER, true);

    const colleagues = await factory!.createAdditionalContract(company);
    const colleaguesParty = await factory!.createAdditionalParty(colleagues, company);
    await assign(colleaguesParty, colleague, EContractorContractRole.FINANCE_OFFICER);

    // An ordinary member's whole list is already only their own contracts.
    const scope = {
      companyId: company.id,
      companyUserId: actor.id,
      includeCompanyAdminOversight: true,
    };
    const everything = await contracts.searchPage(scope, { take: 50 });
    const mine = await contracts.searchPage(scope, {
      take: 50,
      assignedToCompanyUserId: actor.id,
    });
    expect(everything.items.map((c) => c.id)).toEqual([assigned.id]);
    expect(everything.total).toBe(1);
    expect(mine.items.map((c) => c.id)).toEqual([assigned.id]);
    expect(mine.total).toBe(1);

    // A Company Administrator sees every party contract through oversight;
    // the filter still narrows to their own (none here).
    const admin = await factory!.createAdditionalMember(
      company,
      ECompanyRole.COMPANY_ADMIN,
    );
    const adminScope = { ...scope, companyUserId: admin.id };
    const overseen = await contracts.searchPage(adminScope, { take: 50 });
    expect(overseen.items.map((c) => c.id).sort()).toEqual(
      [assigned.id, unassigned.id, revoked.id, colleagues.id].sort(),
    );
    await expect(
      contracts.searchPage(adminScope, {
        take: 50,
        assignedToCompanyUserId: admin.id,
      }),
    ).resolves.toEqual({ items: [], total: 0 });
  });

  it("returns only the member's own active roles, inside the scoped company", async () => {
    const { company, actor, contract } = await factory!.createLifecycleFixture();
    const colleague = await factory!.createAdditionalMember(company);
    const party = (await dataSource!
      .getRepository(ContractRoleAssignment)
      .findOneByOrFail({ companyUserId: actor.id })).contractPartyId;
    await assign(
      { id: party } as ContractParty,
      colleague,
      EContractorContractRole.FINANCE_OFFICER,
    );
    // Another company on the same contract, with its own member and role.
    const { company: other, member: outsider } =
      await factory!.createCompanyMember();
    const otherParty = await factory!.createAdditionalParty(contract, other);
    await assign(otherParty, outsider, EContractorContractRole.HSE_OFFICER);

    const roles = await assignments.findActiveRolesForContracts(
      { companyId: company.id },
      actor.id,
      [contract.id],
    );
    expect(roles).toEqual([
      {
        contractId: contract.id,
        role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
        isWorkspaceAdmin: false,
      },
    ]);

    // The member's id under another company's scope finds nothing.
    await expect(
      assignments.findActiveRolesForContracts(
        { companyId: other.id },
        actor.id,
        [contract.id],
      ),
    ).resolves.toEqual([]);
    await expect(
      contracts.searchPage(
        {
          companyId: other.id,
          companyUserId: actor.id,
          includeCompanyAdminOversight: true,
        },
        { take: 50, assignedToCompanyUserId: actor.id },
      ),
    ).resolves.toEqual({ items: [], total: 0 });
  });
});
