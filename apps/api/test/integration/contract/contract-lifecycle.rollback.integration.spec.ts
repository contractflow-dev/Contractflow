import { randomUUID } from 'node:crypto';
import { EContractStatus, EToStatus } from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractStatusHistory } from '../../../src/modules/contract/entities/contract-status-history.entity';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';
import { installPostgresFailureTrigger } from '../database/postgres-failure-trigger';

describe('ContractLifecycleService PostgreSQL rollback integration', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let service: ContractLifecycleService;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const mail = {
      sendContractPartyInvitationEmail: async () => undefined,
    } as unknown as MailService;
    service = new ContractLifecycleService(
      new TypeOrmUnitOfWork(dataSource, new ContractLifecycleContextFactory()),
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

  it('persists contract status, history, and activity together on a successful transition', async () => {
    const fixture = await factory!.createLifecycleFixture();

    await service.transition(
      fixture.actor.userId,
      fixture.company.id,
      fixture.contract.id,
      { transition: 'activate', reason: 'Integration test approval.' },
    );

    const runner = dataSource!.createQueryRunner();
    await runner.connect();
    try {
      const [contract] = (await runner.query(
        'SELECT status FROM contract WHERE id = $1',
        [fixture.contract.id],
      )) as Array<{ status: EContractStatus }>;
      const [history] = (await runner.query(
        `SELECT COUNT(*)::int AS count
         FROM contract_status_history
         WHERE contract_id = $1 AND to_status = $2`,
        [fixture.contract.id, EToStatus.ACTIVE],
      )) as Array<{ count: number }>;
      const [activity] = (await runner.query(
        `SELECT COUNT(*)::int AS count
         FROM activity_log
         WHERE contract_id = $1 AND action = $2`,
        [fixture.contract.id, 'contract.status_transitioned'],
      )) as Array<{ count: number }>;

      expect(contract.status).toBe(EContractStatus.ACTIVE);
      expect(history.count).toBe(1);
      expect(activity.count).toBe(1);
    } finally {
      await runner.release();
    }
  });

  it('rolls back contract and audit writes when the database rejects a history insert', async () => {
    const fixture = await factory!.createLifecycleFixture();
    const marker = `fail-history-${randomUUID()}`;
    const removeFailure = await installPostgresFailureTrigger(dataSource!, {
      table: 'contract_status_history',
      contractId: fixture.contract.id,
      column: 'reason',
      marker,
    });

    try {
      await expect(
        service.transition(
          fixture.actor.userId,
          fixture.company.id,
          fixture.contract.id,
          { transition: 'activate', reason: marker },
        ),
      ).rejects.toThrow();

      const runner = dataSource!.createQueryRunner();
      await runner.connect();
      try {
        const [contract] = (await runner.query(
          'SELECT status FROM contract WHERE id = $1',
          [fixture.contract.id],
        )) as Array<{ status: EContractStatus }>;
        const [counts] = (await runner.query(
          `SELECT
             (SELECT COUNT(*)::int FROM contract_status_history WHERE contract_id = $1) AS history_count,
             (SELECT COUNT(*)::int FROM activity_log WHERE contract_id = $1) AS activity_count`,
          [fixture.contract.id],
        )) as Array<{ history_count: number; activity_count: number }>;

        expect(contract.status).toBe(EContractStatus.DRAFT);
        expect(counts).toEqual({ history_count: 0, activity_count: 0 });
      } finally {
        await runner.release();
      }
    } finally {
      await removeFailure();
    }
  });

  it('rolls back contract and history writes when the database rejects an activity insert', async () => {
    const fixture = await factory!.createLifecycleFixture();
    const removeFailure = await installPostgresFailureTrigger(dataSource!, {
      table: 'activity_log',
      contractId: fixture.contract.id,
      column: 'action',
      marker: 'contract.status_transitioned',
    });

    try {
      await expect(
        service.transition(
          fixture.actor.userId,
          fixture.company.id,
          fixture.contract.id,
          { transition: 'activate', reason: 'Integration test approval.' },
        ),
      ).rejects.toThrow();

      const runner = dataSource!.createQueryRunner();
      await runner.connect();
      try {
        const [contract] = (await runner.query(
          'SELECT status FROM contract WHERE id = $1',
          [fixture.contract.id],
        )) as Array<{ status: EContractStatus }>;
        const [counts] = (await runner.query(
          `SELECT
             (SELECT COUNT(*)::int FROM contract_status_history WHERE contract_id = $1) AS history_count,
             (SELECT COUNT(*)::int FROM activity_log WHERE contract_id = $1) AS activity_count`,
          [fixture.contract.id],
        )) as Array<{ history_count: number; activity_count: number }>;

        expect(contract.status).toBe(EContractStatus.DRAFT);
        expect(counts).toEqual({ history_count: 0, activity_count: 0 });
      } finally {
        await runner.release();
      }
    } finally {
      await removeFailure();
    }
  });

  it('checks the persisted initial contract state before starting each rollback scenario', async () => {
    const fixture = await factory!.createLifecycleFixture();
    const status = await dataSource!.getRepository(Contract).findOne({
      where: { id: fixture.contract.id },
      select: { status: true },
    });
    const historyCount = await dataSource!
      .getRepository(ContractStatusHistory)
      .count({ where: { contractId: fixture.contract.id } });
    const activityCount = await dataSource!
      .getRepository(ActivityLog)
      .count({ where: { contractId: fixture.contract.id } });

    expect(status?.status).toBe(EContractStatus.DRAFT);
    expect(historyCount).toBe(0);
    expect(activityCount).toBe(0);
  });
});
