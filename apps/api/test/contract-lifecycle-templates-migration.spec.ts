import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { ContractLifecycleTemplates1794100000000 } from '../src/common/database/migrations/1794100000000-contract-lifecycle-templates';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs ContractLifecycleTemplates1794100000000 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the other migration
 * suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_lifecycle_${randomUUID().replace(/-/g, '')}`;
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
  'ContractLifecycleTemplates1794100000000 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new ContractLifecycleTemplates1794100000000();

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
    const labels = async (typeName: string): Promise<string[]> => {
      const rows = (await dataSource.query(
        `SELECT enumlabel::text AS label FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = $1 ORDER BY enumsortorder`,
        [typeName],
      )) as Array<{ label: string }>;
      return rows.map(({ label }) => label);
    };

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the tests apply it by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(ContractLifecycleTemplates1794100000000),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      // An existing contract with a stage typed in by hand.
      await dataSource.query(
        `INSERT INTO "contract"
           ("id", "reference_number", "title", "contract_type", "status",
            "original_value_minor", "current_value_minor", "currency_code",
            "retention_rate_bps", "payment_terms_days", "award_date",
            "start_date", "end_date", "defects_liability_days", "timezone")
         VALUES ('OLD', 'OLD', 'Old', 'service', 'active', 100, 100, 'NGN', 0,
                 30, '2026-01-01', '2026-01-02', '2026-12-31', 0, 'UTC')`,
      );
      await dataSource.query(
        `INSERT INTO "contract_stage"
           ("id", "contract_id", "name", "sequence", "status", "weight_bps",
            "planned_start_date", "planned_end_date")
         VALUES ('OLD_STAGE', 'OLD', 'Civil works', 1, 'in_progress', 6000,
                 '2026-01-02', '2026-06-30')`,
      );
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('seeds the published nine-stage system lifecycle, totalling 100%', async () => {
      await withRunner((runner) => migration.up(runner));

      const stages = (await dataSource.query(
        `SELECT s."stage_code" AS code, s."default_weight_bps" AS weight,
                s."completes_on_activation" AS completes
           FROM "lifecycle_template_stage" s
           JOIN "lifecycle_template_version" v ON v."id" = s."lifecycle_template_version_id"
          WHERE v."status" = 'published'
          ORDER BY s."sequence"`,
      )) as Array<{ code: string; weight: number; completes: boolean }>;
      expect(stages.map(({ code }) => code)).toEqual([
        'contract_award',
        'mobilisation',
        'contract_execution',
        'performance_monitoring',
        'change_management',
        'inspection_acceptance',
        'commercial_reconciliation',
        'contract_closeout',
        'post_contract_obligations',
      ]);
      expect(stages.reduce((sum, { weight }) => sum + weight, 0)).toBe(10000);
      expect(stages.filter(({ completes }) => completes)).toEqual([
        { code: 'contract_award', weight: 0, completes: true },
      ]);
      expect(await labels('contract_status_enum')).toEqual([
        'draft',
        'active',
        'suspended',
        'defects_liability',
        'completed',
      ]);
    });

    it('leaves an existing stage as it was: applicable, with no code', async () => {
      const [old] = (await dataSource.query(
        `SELECT "stage_code" AS code, "is_applicable" AS applicable,
                "weight_bps" AS weight, "status"::text AS status
           FROM "contract_stage" WHERE "id" = 'OLD_STAGE'`,
      )) as Array<Record<string, unknown>>;
      expect(old).toEqual({
        code: null,
        applicable: true,
        weight: 6000,
        status: 'in_progress',
      });
      const [contract] = (await dataSource.query(
        `SELECT "lifecycle_template_version_id" AS version FROM "contract" WHERE "id" = 'OLD'`,
      )) as Array<{ version: string | null }>;
      expect(contract.version).toBeNull();
    });

    it('enforces the new rules', async () => {
      await expect(
        dataSource.query(
          `UPDATE "contract_stage" SET "is_applicable" = false WHERE "id" = 'OLD_STAGE'`,
        ),
      ).rejects.toThrow(/ck_contract_stage_not_applicable_reason/);
      await expect(
        dataSource.query(
          `UPDATE "contract_stage" SET "weight_bps" = 10001 WHERE "id" = 'OLD_STAGE'`,
        ),
      ).rejects.toThrow(/ck_contract_stage_weight/);
      await expect(
        dataSource.query(
          `UPDATE "lifecycle_template_stage" SET "default_weight_bps" = 1`,
        ),
      ).rejects.toThrow(/published lifecycle template version can't change/);
      await expect(
        dataSource.query(
          `INSERT INTO "lifecycle_template" ("id", "code", "name", "owner_kind")
           VALUES ('COMPANY_TEMPLATE', 'mine', 'Mine', 'company')`,
        ),
      ).rejects.toThrow(/ck_lifecycle_template_system_only/);
    });

    it('refuses to roll back while a contract is in defects liability', async () => {
      await dataSource.query(
        `UPDATE "contract" SET "status" = 'defects_liability' WHERE "id" = 'OLD'`,
      );
      await expect(
        withRunner((runner) => migration.down(runner)),
      ).rejects.toThrow(/1 contract or history row\(s\) use it/);
      await dataSource.query(
        `UPDATE "contract" SET "status" = 'active' WHERE "id" = 'OLD'`,
      );
    });

    it('rolls back, keeping existing contracts and stages', async () => {
      await withRunner((runner) => migration.down(runner));

      expect(await labels('contract_status_enum')).toEqual([
        'draft',
        'active',
        'suspended',
        'completed',
      ]);
      const [{ stages }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS stages FROM "contract_stage" WHERE "id" = 'OLD_STAGE'`,
      )) as Array<{ stages: number }>;
      expect(stages).toBe(1);
      const [{ gone }] = (await dataSource.query(
        `SELECT to_regclass('lifecycle_template') IS NULL AS gone`,
      )) as Array<{ gone: boolean }>;
      expect(gone).toBe(true);
    });
  },
);
