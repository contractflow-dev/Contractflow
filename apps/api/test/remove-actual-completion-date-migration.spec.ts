import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { RemoveActualCompletionDate1794000000004 } from '../src/common/database/migrations/1794000000004-remove-actual-completion-date';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs RemoveActualCompletionDate1794000000004 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the other migration
 * suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_completion_${randomUUID().replace(/-/g, '')}`;
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
  'RemoveActualCompletionDate1794000000004 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new RemoveActualCompletionDate1794000000004();

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
    const hasColumn = async (): Promise<boolean> => {
      const rows = (await dataSource.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contract'
            AND column_name = 'actual_completion_date'`,
      )) as unknown[];
      return rows.length > 0;
    };
    const insertContract = (id: string, completed: string | null) =>
      dataSource.query(
        `INSERT INTO "contract"
           ("id", "reference_number", "title", "contract_type", "status",
            "original_value_minor", "current_value_minor", "currency_code",
            "retention_rate_bps", "payment_terms_days", "award_date",
            "start_date", "end_date", "actual_completion_date",
            "defects_liability_days", "timezone")
         VALUES ($1, $1, $1, 'service', 'completed', 100, 100, 'NGN', 0, 30,
                 '2026-01-01', '2026-01-02', '2026-12-31', $2, 0, 'UTC')`,
        [id, completed],
      );

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the tests apply it by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(RemoveActualCompletionDate1794000000004),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      await insertContract('WITH_DATE', '2026-11-30');
      await insertContract('WITHOUT_DATE', null);
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('drops the column after backing up every stored date', async () => {
      await withRunner((runner) => migration.up(runner));

      expect(await hasColumn()).toBe(false);
      const backups = (await dataSource.query(
        `SELECT "contract_id" AS id, "actual_completion_date"::text AS date
           FROM "migration_contract_actual_completion_backup"`,
      )) as Array<{ id: string; date: string }>;
      expect(backups).toEqual([{ id: 'WITH_DATE', date: '2026-11-30' }]);
      // Every contract is kept.
      const [{ contracts }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS contracts FROM "contract"`,
      )) as Array<{ contracts: number }>;
      expect(contracts).toBe(2);
    });

    it('rolls back to exactly the earlier dates', async () => {
      await withRunner((runner) => migration.down(runner));

      expect(await hasColumn()).toBe(true);
      const rows = (await dataSource.query(
        `SELECT "id", "actual_completion_date"::text AS date FROM "contract"
          ORDER BY "id"`,
      )) as Array<{ id: string; date: string | null }>;
      expect(rows).toEqual([
        { id: 'WITHOUT_DATE', date: null },
        { id: 'WITH_DATE', date: '2026-11-30' },
      ]);
      const [{ backup }] = (await dataSource.query(
        `SELECT to_regclass('migration_contract_actual_completion_backup') IS NULL AS backup`,
      )) as Array<{ backup: boolean }>;
      expect(backup).toBe(true);
    });
  },
);
