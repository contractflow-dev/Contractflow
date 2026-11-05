import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EContractRole } from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractRoleAssignmentService } from '../../../src/modules/contract/services/contract-role-assignment.service';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import {
  ContractRoleAssignmentTransactionContextFactory,
  TypeOrmContractRoleAssignmentContext,
} from '../../../src/modules/contract/repositories/contract-role-assignment-transaction-context.factory';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';
import { installPostgresFailureTrigger } from '../database/postgres-failure-trigger';

describe('ContractRoleAssignmentService PostgreSQL rollback integration', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let service: ContractRoleAssignmentService;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const mail = {
      sendContractRoleInvitationEmail: async () => undefined,
    } as unknown as MailService;
    service = new ContractRoleAssignmentService(
      new TypeOrmContractRoleAssignmentContext(dataSource.manager),
      new TypeOrmUnitOfWork(
        dataSource,
        new ContractRoleAssignmentTransactionContextFactory(),
      ),
      mail,
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

  it('persists an assignment and its activity audit on success', async () => {
    const fixture = await factory!.createRoleAssignmentFixture();

    const response = await service.assign(
      fixture.actor.userId,
      fixture.company.id,
      fixture.contract.id,
      'finance',
      fixture.target.id,
      EContractRole.FINANCE_OFFICER,
    );

    const persisted = await dataSource!
      .getRepository(ContractRoleAssignment)
      .findOneBy({ id: response.id });
    const activityCount = await dataSource!.getRepository(ActivityLog).count({
      where: {
        contractId: fixture.contract.id,
        action: 'contract.role_assigned',
      },
    });

    expect(persisted).toMatchObject({
      contractPartyId: fixture.party.id,
      companyUserId: fixture.target.id,
      companyId: fixture.company.id,
      role: EContractRole.FINANCE_OFFICER,
    });
    expect(activityCount).toBe(1);
  });

  it('rolls back a persisted role assignment when the activity insert fails in PostgreSQL', async () => {
    const fixture = await factory!.createRoleAssignmentFixture();
    const removeFailure = await installPostgresFailureTrigger(dataSource!, {
      table: 'activity_log',
      contractId: fixture.contract.id,
      column: 'action',
      marker: 'contract.role_assigned',
    });

    try {
      await expect(
        service.assign(
          fixture.actor.userId,
          fixture.company.id,
          fixture.contract.id,
          'finance',
          fixture.target.id,
          EContractRole.FINANCE_OFFICER,
        ),
      ).rejects.toThrow();

      const runner = dataSource!.createQueryRunner();
      await runner.connect();
      try {
        const [counts] = (await runner.query(
          `SELECT
             (SELECT COUNT(*)::int
              FROM contract_role_assignment
              WHERE contract_party_id = $1 AND company_user_id = $2) AS assignment_count,
             (SELECT COUNT(*)::int
              FROM activity_log
              WHERE contract_id = $3 AND action = $4) AS activity_count`,
          [
            fixture.party.id,
            fixture.target.id,
            fixture.contract.id,
            'contract.role_assigned',
          ],
        )) as Array<{ assignment_count: number; activity_count: number }>;

        expect(counts).toEqual({ assignment_count: 0, activity_count: 0 });
      } finally {
        await runner.release();
      }
    } finally {
      await removeFailure();
    }
  });

  it('rejects role assignment when the requesting company is not a contract party', async () => {
    const fixture = await factory!.createRoleAssignmentFixture();
    const outsider = await factory!.createCompanyMember();

    await expect(
      service.assign(
        outsider.member.userId,
        outsider.company.id,
        fixture.contract.id,
        'finance',
        fixture.target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await dataSource!.getRepository(ContractRoleAssignment).count({
        where: { contractPartyId: fixture.party.id },
      }),
    ).toBe(0);
  });

  it('does not revoke an assignment belonging to another contract party', async () => {
    const fixture = await factory!.createRoleAssignmentFixture();
    const otherContract = await factory!.createAdditionalContract(
      fixture.company,
    );
    const otherParty = await factory!.createAdditionalParty(
      otherContract,
      fixture.company,
    );
    await factory!.createAdditionalWorkspace(
      otherContract,
      fixture.actor,
      'finance',
    );
    const assignmentRepository = dataSource!.getRepository(
      ContractRoleAssignment,
    );
    const foreignAssignment = await assignmentRepository.save(
      assignmentRepository.create({
        contractPartyId: otherParty.id,
        companyUserId: fixture.target.id,
        companyId: fixture.company.id,
        role: EContractRole.FINANCE_OFFICER,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: fixture.actor.id,
        revokedAt: null,
        revokedById: null,
      }),
    );

    await expect(
      service.revoke(
        fixture.actor.userId,
        fixture.company.id,
        fixture.contract.id,
        foreignAssignment.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    const persisted = await dataSource!
      .getRepository(ContractRoleAssignment)
      .findOneBy({ id: foreignAssignment.id });
    expect(persisted?.revokedAt).toBeNull();
  });

  it('rejects inactive actors and targets who belong to another company', async () => {
    const fixture = await factory!.createRoleAssignmentFixture();
    const outsider = await factory!.createCompanyMember();

    await expect(
      service.assign(
        'not-a-member',
        fixture.company.id,
        fixture.contract.id,
        'finance',
        fixture.target.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.assign(
        fixture.actor.userId,
        fixture.company.id,
        fixture.contract.id,
        'finance',
        outsider.member.id,
        EContractRole.FINANCE_OFFICER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await dataSource!.getRepository(ContractRoleAssignment).count({
        where: { contractPartyId: fixture.party.id },
      }),
    ).toBe(0);
  });
});
