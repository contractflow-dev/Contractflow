import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  EContractType,
  EContractorContractRole,
  ECurrencyCode,
  EPartyType,
} from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../../../src/modules/contract/entities/contract-role-invitation.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Workspaces are part of a contract's configuration, not access: adding one
 * gives nobody a role, and removing one revokes its roles and invitations
 * for every party while keeping their history.
 */
describe('Contract workspace management (PostgreSQL)', () => {
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let service: ContractLifecycleService;
  const createdContractIds = new Set<string>();

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    service = new ContractLifecycleService(
      new TypeOrmUnitOfWork(dataSource, new ContractLifecycleContextFactory()),
      {
        sendContractPartyInvitationEmail: async () => undefined,
      } as unknown as MailService,
    );
  }, 60_000);

  afterEach(async () => {
    // Contracts made through the service aren't tracked by the factory.
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

  const workspacesOf = async (contractId: string) =>
    (
      await dataSource
        .getRepository(ContractWorkspaceEntity)
        .find({ where: { contractId } })
    )
      .map(({ workspace }) => workspace)
      .sort();

  const activeAssignmentsOn = (contractId: string) =>
    dataSource
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder('assignment')
      .innerJoin('assignment.contractParty', 'party')
      .where('party.contractId = :contractId', { contractId })
      .andWhere('assignment.revokedAt IS NULL')
      .getCount();

  async function assign(
    partyId: string,
    companyId: string,
    member: CompanyUser,
    role: EContractorContractRole,
    isWorkspaceAdmin = false,
  ) {
    const repository = dataSource.getRepository(ContractRoleAssignment);
    return repository.save(
      repository.create({
        contractPartyId: partyId,
        companyId,
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

  it('creates a contract with exactly the chosen workspaces and no roles', async () => {
    const { company, actor } = await factory.createRoleAssignmentFixture();

    const created = await service.create(actor.userId, company.id, {
      referenceNumber: `WS-${Date.now()}`,
      title: 'Workspace creation',
      contractType: EContractType.SERVICE,
      partyType: EPartyType.CLIENT,
      workspaces: ['project', 'hse'],
      originalValueMinor: 100_000,
      currencyCode: ECurrencyCode.NGN,
      retentionRateBps: 500,
      paymentTermsDays: 30,
      awardDate: '2026-01-01',
      startDate: '2026-01-02',
      endDate: '2027-01-01',
      defectsLiabilityDays: 365,
      timezone: 'Africa/Lagos',
    });
    createdContractIds.add(created.id);

    expect(await workspacesOf(created.id)).toEqual(['hse', 'project']);
    // Creating workspaces gives nobody access, the creating admin included.
    expect(await activeAssignmentsOn(created.id)).toBe(0);
  });

  it('adds a workspace without giving anyone access, and refuses a duplicate', async () => {
    const { company, actor, contract } =
      await factory.createRoleAssignmentFixture();

    await expect(
      service.addWorkspace(actor.userId, company.id, contract.id, 'project'),
    ).resolves.toEqual(expect.arrayContaining(['finance', 'project']));

    expect(await workspacesOf(contract.id)).toEqual(['finance', 'project']);
    expect(await activeAssignmentsOn(contract.id)).toBe(0);
    const audit = await dataSource.getRepository(ActivityLog).findBy({
      contractId: contract.id,
      action: 'contract.workspaces_added',
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: actor.id,
      companyId: company.id,
      // The lifecycle audit stores the details as the change's "after".
      changes: { before: null, after: { added: ['project'] } },
    });

    await expect(
      service.addWorkspace(actor.userId, company.id, contract.id, 'project'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("removes a workspace, revoking every party's roles and invitations in it but keeping their history", async () => {
    const { company, actor, target, contract, party } =
      await factory.createRoleAssignmentFixture();
    // A second company on the same contract, with its own Finance role.
    const other = await factory.createCompanyMember(ECompanyRole.MEMBER);
    const otherParty = await factory.createAdditionalParty(
      contract,
      other.company,
    );
    await factory.createAdditionalWorkspace(contract, actor, 'project');
    const financeAdmin = await assign(
      party.id,
      company.id,
      target,
      EContractorContractRole.FINANCE_OFFICER,
      true,
    );
    const otherFinance = await assign(
      otherParty.id,
      other.company.id,
      other.member,
      EContractorContractRole.FINANCE_DIRECTOR,
    );
    const project = await assign(
      party.id,
      company.id,
      target,
      EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    );
    const invitations = dataSource.getRepository(ContractRoleInvitation);
    const invitation = await invitations.save(
      invitations.create({
        contractPartyId: party.id,
        companyId: company.id,
        invitedById: actor.id,
        email: `finance-${Date.now()}@integration.contractflow.test`,
        role: EContractorContractRole.FINANCE_OFFICER,
        workspace: 'finance',
        isWorkspaceAdmin: false,
        tokenHash: 'a'.repeat(64),
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
        respondedAt: null,
        revokedAt: null,
      }),
    );

    await expect(
      service.workspaceRemovalImpact(
        actor.userId,
        company.id,
        contract.id,
        'finance',
      ),
    ).resolves.toEqual({
      workspace: 'finance',
      activeRoleAssignmentCount: 2,
      workspaceAdminCount: 1,
      pendingRoleInvitationCount: 1,
    });

    await expect(
      service.removeWorkspace(actor.userId, company.id, contract.id, 'finance'),
    ).resolves.toEqual(['project']);

    expect(await workspacesOf(contract.id)).toEqual(['project']);
    const assignments = dataSource.getRepository(ContractRoleAssignment);
    // Revoked, not deleted: both parties' Finance roles keep their history.
    for (const revoked of [financeAdmin, otherFinance]) {
      expect(
        await assignments.findOneByOrFail({ id: revoked.id }),
      ).toMatchObject({ revokedAt: expect.any(Date), revokedById: actor.id });
    }
    // Another workspace's role is untouched.
    expect(await assignments.findOneByOrFail({ id: project.id })).toMatchObject(
      { revokedAt: null },
    );
    expect(
      await invitations.findOneByOrFail({ id: invitation.id }),
    ).toMatchObject({ status: 'revoked', revokedAt: expect.any(Date) });
    const audit = await dataSource.getRepository(ActivityLog).findOneByOrFail({
      contractId: contract.id,
      action: 'contract.workspaces_removed',
    });
    expect(audit).toMatchObject({
      actorUserId: actor.id,
      changes: {
        before: null,
        after: {
          removed: ['finance'],
          revokedRoleAssignments: 2,
          revokedRoleInvitations: 1,
        },
      },
    });
  });

  it("refuses another company's administrator and a workspace administrator", async () => {
    const { company, target, contract, party } =
      await factory.createRoleAssignmentFixture();
    await assign(
      party.id,
      company.id,
      target,
      EContractorContractRole.FINANCE_OFFICER,
      true,
    );
    const outsider = await factory.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    );

    await expect(
      service.addWorkspace(
        outsider.member.userId,
        outsider.company.id,
        contract.id,
        'project',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeWorkspace(
        outsider.member.userId,
        outsider.company.id,
        contract.id,
        'finance',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    // The Finance workspace admin is an ordinary company member.
    await expect(
      service.removeWorkspace(
        target.userId,
        company.id,
        contract.id,
        'finance',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await workspacesOf(contract.id)).toEqual(['finance']);
  });

  it('lets only one of two concurrent identical additions succeed', async () => {
    const { company, actor, contract } =
      await factory.createRoleAssignmentFixture();

    const results = await Promise.allSettled([
      service.addWorkspace(actor.userId, company.id, contract.id, 'hse'),
      service.addWorkspace(actor.userId, company.id, contract.id, 'hse'),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await workspacesOf(contract.id)).toEqual(['finance', 'hse']);
  });
});
