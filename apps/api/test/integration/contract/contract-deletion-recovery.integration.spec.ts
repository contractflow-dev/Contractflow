import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ECompanyRole,
  EContractorContractRole,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../../../src/modules/contract/entities/contract-role-invitation.entity';
import { ContractStatusHistory } from '../../../src/modules/contract/entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractStatusHistoryRepository } from '../../../src/modules/contract/repositories/contract-status-history.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import { ContractService } from '../../../src/modules/contract/services/contract.service';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { CompanyUser as CompanyUserEntity } from '../../../src/modules/identity/entities/company-user.entity';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { CompanyScopeService } from '../../../src/modules/identity/services/company/company-scope.service';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Archiving (deleting) a contract hides it and ends all access, but keeps
 * every record; restoring brings back the same contract and records without
 * restoring any access.
 */
describe('Contract deletion and recovery (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let lifecycle: ContractLifecycleService;
  let contracts: ContractService;
  const createdContractIds = new Set<string>();

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    lifecycle = new ContractLifecycleService(
      new TypeOrmUnitOfWork(dataSource, new ContractLifecycleContextFactory()),
      {
        sendContractPartyInvitationEmail: async () => undefined,
      } as unknown as MailService,
    );
    const companyUsers = new CompanyUserRepository(
      dataSource.getRepository(CompanyUserEntity),
    );
    const parties = new ContractPartyRepository(
      dataSource.getRepository(ContractParty),
    );
    const roleAssignments = new ContractRoleAssignmentRepository(
      dataSource.getRepository(ContractRoleAssignment),
    );
    const contractRepository = new ContractRepository(
      dataSource.getRepository(Contract),
    );
    const workspaces = new ContractWorkspaceRepository(
      dataSource.getRepository(ContractWorkspaceEntity),
      dataSource.getRepository(ContractParty),
    );
    contracts = new ContractService(
      new CompanyScopeService(companyUsers),
      parties,
      new ContractStatusHistoryRepository(
        dataSource.getRepository(ContractStatusHistory),
      ),
      contractRepository,
      companyUsers,
      workspaces,
      roleAssignments,
      new ContractAccessService(
        companyUsers,
        parties,
        roleAssignments,
        contractRepository,
        workspaces,
      ),
    );
  }, 60_000);

  afterEach(async () => {
    for (const id of createdContractIds) {
      await dataSource.getRepository(Contract).delete({ id });
    }
    createdContractIds.clear();
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await factory.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  /** Rows that reference the contract, per table, from the live schema. */
  async function rowsReferencing(contractId: string) {
    const tables = (await dataSource.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND column_name = 'contract_id'
       ORDER BY table_name`,
    )) as Array<{ table_name: string }>;
    const counts: Record<string, number> = {};
    for (const { table_name } of tables) {
      const [{ count }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${table_name}" WHERE contract_id = $1`,
        [contractId],
      )) as Array<{ count: number }>;
      counts[table_name] = count;
    }
    // Each role assignment and invitation, through its party.
    for (const table of [
      'contract_role_assignment',
      'contract_role_invitation',
    ]) {
      const [{ count }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${table}" t
         JOIN contract_party p ON p.id = t.contract_party_id
         WHERE p.contract_id = $1`,
        [contractId],
      )) as Array<{ count: number }>;
      counts[table] = count;
    }
    return counts;
  }

  async function assign(
    party: ContractParty,
    member: CompanyUser,
    role: EContractorContractRole,
    isWorkspaceAdmin = false,
  ) {
    const repository = dataSource.getRepository(ContractRoleAssignment);
    return repository.save(
      repository.create({
        contractPartyId: party.id,
        companyId: party.companyId,
        companyUserId: member.id,
        role,
        isWorkspaceAdmin,
        assignedAt: new Date(),
        assignedById: member.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
  }

  /** A contract with two companies, roles on both sides and a subcontract. */
  async function populatedContract() {
    const { company, actor, target, contract, party } =
      await factory.createRoleAssignmentFixture();
    const other = await factory.createCompanyMember(ECompanyRole.COMPANY_ADMIN);
    const otherParty = await factory.createAdditionalParty(
      contract,
      other.company,
    );
    const roles = [
      await assign(
        party,
        target,
        EContractorContractRole.FINANCE_OFFICER,
        true,
      ),
      await assign(
        otherParty,
        other.member,
        EContractorContractRole.FINANCE_DIRECTOR,
      ),
    ];
    const invitations = dataSource.getRepository(ContractRoleInvitation);
    const invitation = await invitations.save(
      invitations.create({
        contractPartyId: party.id,
        companyId: company.id,
        invitedById: actor.id,
        email: `pending-${Date.now()}@integration.contractflow.test`,
        role: EContractorContractRole.FINANCE_OFFICER,
        workspace: 'finance',
        isWorkspaceAdmin: false,
        tokenHash: `${Date.now()}`.padEnd(64, 'b'),
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
        respondedAt: null,
        revokedAt: null,
      }),
    );
    const subcontract = await factory.createAdditionalContract(company);
    await dataSource
      .getRepository(Contract)
      .update({ id: subcontract.id }, { parentContractId: contract.id });
    return {
      company,
      actor,
      target,
      contract,
      party,
      other,
      roles,
      invitation,
      subcontract,
    };
  }

  it('keeps every record when a contract is archived, and restores the same contract without restoring access', async () => {
    const { company, actor, contract, other, roles, invitation, subcontract } =
      await populatedContract();
    const before = await rowsReferencing(contract.id);
    const original = await dataSource
      .getRepository(Contract)
      .findOneByOrFail({ id: contract.id });

    await expect(
      lifecycle.deletionImpact(actor.userId, company.id, contract.id),
    ).resolves.toEqual({
      activeRoleAssignmentCount: 2,
      workspaceAdminCount: 1,
      pendingRoleInvitationCount: 1,
      pendingPartyInvitationCount: 0,
      otherPartyCount: 1,
      subcontractCount: 1,
    });

    await lifecycle.archive(actor.userId, company.id, contract.id);

    const archived = await dataSource
      .getRepository(Contract)
      .findOneByOrFail({ id: contract.id });
    expect(archived).toMatchObject({
      deletedAt: expect.any(Date),
      deletedByCompanyUserId: actor.id,
      status: original.status,
    });
    // Nothing deleted: the same rows reference the contract, plus its audit.
    const afterArchive = await rowsReferencing(contract.id);
    expect({ ...afterArchive, activity_log: 0 }).toEqual({
      ...before,
      activity_log: 0,
    });
    expect(afterArchive.activity_log).toBe(before.activity_log + 1);
    const assignments = dataSource.getRepository(ContractRoleAssignment);
    for (const role of roles) {
      expect(await assignments.findOneByOrFail({ id: role.id })).toMatchObject({
        revokedAt: expect.any(Date),
      });
    }
    expect(
      await dataSource
        .getRepository(ContractRoleInvitation)
        .findOneByOrFail({ id: invitation.id }),
    ).toMatchObject({ status: 'revoked' });
    // The subcontract is not archived with it, and still points at it.
    expect(
      await dataSource
        .getRepository(Contract)
        .findOneByOrFail({ id: subcontract.id }),
    ).toMatchObject({ deletedAt: null, parentContractId: contract.id });

    // Out of every active view, but in the creating company's archived list.
    const active = await contracts.list(actor.userId, company.id, {
      page: 1,
      limit: 50,
      includeDeleted: false,
      assignedToMe: false,
    });
    expect(active.data.map(({ id }) => id)).not.toContain(contract.id);
    const archivedList = await contracts.list(actor.userId, company.id, {
      page: 1,
      limit: 50,
      includeDeleted: true,
      assignedToMe: false,
    });
    expect(archivedList.data.map(({ id }) => id)).toContain(contract.id);

    // Read-only history stays open to the creating company's administrator...
    await expect(
      contracts.get(actor.userId, company.id, contract.id),
    ).resolves.toMatchObject({
      contract: { id: contract.id, deletedAt: expect.any(String) },
    });
    expect(
      await contracts.listParties(actor.userId, company.id, contract.id),
    ).toHaveLength(2);
    expect(
      await contracts.listWorkspaces(actor.userId, company.id, contract.id),
    ).toEqual(['finance']);
    // ...and closed to the other party's administrator.
    await expect(
      contracts.get(other.member.userId, other.company.id, contract.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const restored = await lifecycle.restore(
      actor.userId,
      company.id,
      contract.id,
    );
    expect(restored).toMatchObject({
      id: contract.id,
      referenceNumber: original.referenceNumber,
      status: original.status,
      deletedAt: null,
      deletedByCompanyUserId: null,
    });
    const afterRestore = await rowsReferencing(contract.id);
    expect({ ...afterRestore, activity_log: 0 }).toEqual({
      ...before,
      activity_log: 0,
    });
    expect(afterRestore.activity_log).toBe(before.activity_log + 2);
    // Access stays revoked: roles must be assigned again.
    for (const role of roles) {
      expect(await assignments.findOneByOrFail({ id: role.id })).toMatchObject({
        revokedAt: expect.any(Date),
      });
    }
    const activeAgain = await contracts.list(actor.userId, company.id, {
      page: 1,
      limit: 50,
      includeDeleted: false,
      assignedToMe: false,
    });
    expect(activeAgain.data.map(({ id }) => id)).toContain(contract.id);
  });

  it("refuses another company's administrator, even a party to the contract", async () => {
    const { contract, other } = await populatedContract();

    await expect(
      lifecycle.archive(other.member.userId, other.company.id, contract.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (
        await dataSource.getRepository(Contract).findOneByOrFail({
          id: contract.id,
        })
      ).deletedAt,
    ).toBeNull();
  });

  it('archives once and restores once when the requests race', async () => {
    const { company, actor, contract } = await populatedContract();

    const archives = await Promise.allSettled([
      lifecycle.archive(actor.userId, company.id, contract.id),
      lifecycle.archive(actor.userId, company.id, contract.id),
    ]);
    expect(archives.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      archives.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      )?.reason,
    ).toBeInstanceOf(ConflictException);

    const restores = await Promise.allSettled([
      lifecycle.restore(actor.userId, company.id, contract.id),
      lifecycle.restore(actor.userId, company.id, contract.id),
    ]);
    expect(restores.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const [{ count }] = (await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM activity_log
       WHERE contract_id = $1 AND action IN ('contract.deleted', 'contract.restored')`,
      [contract.id],
    )) as Array<{ count: number }>;
    expect(count).toBe(2);
  });

  it('keeps an archived contract out of reach of its former role holders', async () => {
    const { company, target, contract, actor } = await populatedContract();
    await lifecycle.archive(actor.userId, company.id, contract.id);

    await expect(
      contracts.get(target.userId, company.id, contract.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      contracts.listStatusHistory(target.userId, company.id, contract.id, {
        page: 1,
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
