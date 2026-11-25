import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { SubcontractParentRules1794000000002 } from '../src/common/database/migrations/1794000000002-subcontract-parent-rules';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs SubcontractParentRules1794000000002 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the other migration
 * suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_subcontract_${randomUUID().replace(/-/g, '')}`;
  const client = new Client({ connectionString: rootUrl });
  await client.connect();
  try {
    const identity = await client.query(
      'SELECT system_identifier::text AS id FROM pg_catalog.pg_control_system()',
    );
    assertDisposablePostgresSystemIdentifier(
      String(identity.rows[0]?.id ?? ''),
      process.env,
    );
    await client.query(`CREATE DATABASE "${name}"`);
    ownedDatabases.add(name);
  } finally {
    await client.end();
  }
  const url = new URL(rootUrl);
  url.pathname = `/${name}`;
  return { name, url: url.toString() };
}

async function dropDatabase(name: string): Promise<void> {
  assertOwnedDisposableDatabase(name, ownedDatabases);
  const client = new Client({
    connectionString: getDisposablePostgresUrl(process.env),
  });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    ownedDatabases.delete(name);
  } finally {
    await client.end();
  }
}

const describeDisposablePostgres = hasDisposablePostgresTestConfiguration(
  process.env,
)
  ? describe
  : describe.skip;

describeDisposablePostgres(
  'SubcontractParentRules1794000000002 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new SubcontractParentRules1794000000002();

    const withRunner = async (
      step: (
        runner: ReturnType<DataSource['createQueryRunner']>,
      ) => Promise<void>,
    ) => {
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await step(runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }
    };
    const insertContract = (id: string, parent: string | null) =>
      dataSource.query(
        `INSERT INTO "contract"
           ("id", "reference_number", "title", "contract_type", "status",
            "parent_contract_id", "original_value_minor", "current_value_minor",
            "currency_code", "retention_rate_bps", "payment_terms_days",
            "award_date", "start_date", "end_date", "defects_liability_days",
            "timezone")
         VALUES ($1, $1, $1, 'service', 'draft', $2, 100, 100, 'NGN', 0, 30,
                 '2026-01-01', '2026-01-02', '2026-12-31', 0, 'UTC')`,
        [id, parent],
      );
    const parentDeleteRule = async (): Promise<string> => {
      const [row] = (await dataSource.query(
        `SELECT confdeltype AS rule FROM pg_constraint
          WHERE conname = 'FK_f47cfaeabefd9d42a9aae56a488'`,
      )) as Array<{ rule: string }>;
      return row.rule;
    };

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the tests apply it by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(SubcontractParentRules1794000000002),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      await insertContract('MAIN', null);
      await insertContract('SUB', 'MAIN');
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('refuses while a subcontract has a subcontract, changing nothing', async () => {
      await insertContract('NESTED', 'SUB');
      await expect(
        withRunner((runner) => migration.up(runner)),
      ).rejects.toThrow(
        /0 contract\(s\) are their own parent and 1 have a parent/,
      );
      expect(await parentDeleteRule()).toBe('c');
      await dataSource.query(`DELETE FROM "contract" WHERE "id" = 'NESTED'`);
    });

    it('keeps existing links and enforces the rules', async () => {
      await withRunner((runner) => migration.up(runner));

      expect(await parentDeleteRule()).toBe('r');
      const [kept] = (await dataSource.query(
        `SELECT "parent_contract_id" AS parent FROM "contract" WHERE "id" = 'SUB'`,
      )) as Array<{ parent: string }>;
      expect(kept.parent).toBe('MAIN');
      await expect(insertContract('NESTED', 'SUB')).rejects.toThrow(
        /parent must be a main contract/,
      );
      await expect(
        dataSource.query(
          `UPDATE "contract" SET "parent_contract_id" = NULL WHERE "id" = 'SUB'`,
        ),
      ).rejects.toThrow(/cannot be changed/);
      await expect(
        dataSource.query(`DELETE FROM "contract" WHERE "id" = 'MAIN'`),
      ).rejects.toThrow(/foreign key/);
    });

    it('rolls back to the earlier cascade, keeping the links', async () => {
      await withRunner((runner) => migration.down(runner));
      expect(await parentDeleteRule()).toBe('c');
      await dataSource.query(
        `UPDATE "contract" SET "title" = 'Renamed' WHERE "id" = 'SUB'`,
      );
      const [{ triggers }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS triggers FROM pg_trigger
          WHERE tgname = 'contract_parent_rules'`,
      )) as Array<{ triggers: number }>;
      expect(triggers).toBe(0);
    });
  },
);
