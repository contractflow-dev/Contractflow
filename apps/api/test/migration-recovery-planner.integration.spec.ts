import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import {
  assertOwnedDisposableDatabase,
  assertDisposablePostgresSystemIdentifier,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';
import {
  captureDatabaseSnapshot,
  snapshotsEqual,
} from './helpers/schema-snapshot';
import { isSameDatabaseTarget } from '../src/common/database/migration-recovery-planner';
import {
  planMigrationRecovery,
  type RecoveryReport,
} from '../src/scripts/plan-migration-recovery';

const ownedDisposableDatabases = new Set<string>();

function getTestPostgresUrl(): string {
  return getDisposablePostgresUrl(process.env);
}

function getDisposableDbName(suffix: string): string {
  return `cf_plan_test_${suffix}_${randomUUID().replace(/-/g, '')}`;
}

async function createDisposableDatabase(dbName: string): Promise<string> {
  if (!/^cf_plan_test_[a-z0-9_]+$/i.test(dbName)) {
    throw new Error('Generated disposable database name is invalid.');
  }
  const rootUrl = getTestPostgresUrl();
  const client = new Client({ connectionString: rootUrl });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    try {
      const identity = await client.query(`
        SELECT
          current_database() AS database_name,
          system_identifier::text AS system_identifier
        FROM pg_catalog.pg_control_system()
      `);
      const configuredDatabase = decodeURIComponent(
        new URL(rootUrl).pathname.slice(1),
      );
      if (identity.rows[0]?.database_name !== configuredDatabase) {
        throw new Error(
          'The disposable PostgreSQL URL did not connect to its configured administrative database.',
        );
      }
      assertDisposablePostgresSystemIdentifier(
        String(identity.rows[0]?.system_identifier ?? ''),
        process.env,
      );
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query(`CREATE DATABASE "${dbName}"`);
    ownedDisposableDatabases.add(dbName);
  } finally {
    await client.end();
  }
  const parsed = new URL(rootUrl);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

async function dropDisposableDatabase(dbName: string): Promise<void> {
  if (!ownedDisposableDatabases.has(dbName)) return;
  assertOwnedDisposableDatabase(dbName, ownedDisposableDatabases);
  const client = new Client({ connectionString: getTestPostgresUrl() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    ownedDisposableDatabases.delete(dbName);
  } finally {
    await client.end();
  }
}

async function runTypeormMigrations(
  targetUrl: string,
  migrations = registeredMigrations,
): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: targetUrl,
    migrations,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
  await ds.initialize();
  try {
    await ds.runMigrations();
  } finally {
    await ds.destroy();
  }
}

async function captureSnapshot(targetUrl: string) {
  const client = new Client({ connectionString: targetUrl });
  await client.connect();
  try {
    return await captureDatabaseSnapshot(client);
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
  'PostgreSQL Disposable Migration Recovery Integration Tests',
  () => {
    // Give database operations reasonable timeouts
    const DB_TIMEOUT = 60000;

    describe('Scenario 1: An empty disposable database', () => {
      const dbName = getDisposableDbName('empty');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails closed for unverified migrations on an empty database', async () => {
        const report: RecoveryReport = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });

        expect(report.migrationHistoryTablePresent).toBe(false);
        expect(report.unknownHistoryNames).toEqual([]);
        expect(report.migrations).toHaveLength(11);
        for (const entry of report.migrations) {
          expect(entry.status).toBe(
            entry.limitations.length > 0
              ? 'CONFLICTING_OR_UNKNOWN'
              : 'NOT_PRESENT',
          );
          expect(entry.recorded).toBe(false);
        }
        expect(report.proposedPlan.safeToExecute).toBe(false);
        expect(report.proposedPlan.executionImplemented).toBe(false);
        expect(report.proposedPlan.stopAt).toBe(
          'IdentitySchemaBootstrap1749000000000',
        );
      });
    });

    describe('Scenario 2: A fresh database after all registered migrations have run', () => {
      const dbName = getDisposableDbName('fresh_chain');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails closed for migrations with incomplete verification coverage', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });

        expect(report.migrationHistoryTablePresent).toBe(true);
        expect(report.migrationRegistrationMatchesManifest).toBe(true);
        expect(report.unknownHistoryNames).toEqual([]);
        expect(report.migrations).toHaveLength(11);

        for (const entry of report.migrations) {
          expect(entry.recorded).toBe(true);
          for (const probe of entry.probes) {
            expect(probe.present).toBe(true);
          }
          expect(entry.status).toBe(
            entry.limitations.length > 0
              ? 'CONFLICTING_OR_UNKNOWN'
              : 'APPLIED_AND_RECORDED',
          );
        }
        expect(report.proposedPlan.stopAt).toBe(
          'IdentitySchemaBootstrap1749000000000',
        );
        expect(report.proposedPlan.safeToExecute).toBe(false);
        expect(report.proposedPlan.executionImplemented).toBe(false);
      });
    });

    describe('Scenario 3: A second migration run with no pending migrations', () => {
      const dbName = getDisposableDbName('rerun');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('does not mutate history and produces identical plan after second migration run', async () => {
        const ds = new DataSource({
          type: 'postgres',
          url: targetUrl,
          migrations: registeredMigrations,
          synchronize: false,
          migrationsRun: false,
          logging: false,
        });
        await ds.initialize();
        const executed = await ds.runMigrations();
        await ds.destroy();
        expect(executed).toHaveLength(0);

        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        for (const entry of report.migrations) {
          expect(entry.status).toBe(
            entry.limitations.length > 0
              ? 'CONFLICTING_OR_UNKNOWN'
              : 'APPLIED_AND_RECORDED',
          );
        }
        expect(report.proposedPlan.stopAt).toBe(
          'IdentitySchemaBootstrap1749000000000',
        );
      });
    });

    describe('Scenario 4: Planner execution twice against the same fully migrated database', () => {
      const dbName = getDisposableDbName('idempotent');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('produces identical report on repeated execution without mutating state', async () => {
        const report1 = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const report2 = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });

        expect(report1).toEqual(report2);
      });
    });

    describe('Scenario 5: A recorded migration with a missing required column', () => {
      const dbName = getDisposableDbName('missing_col');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            'ALTER TABLE contract DROP CONSTRAINT IF EXISTS fk_contract_created_by_company',
          );
          await client.query(
            'ALTER TABLE contract DROP COLUMN IF EXISTS created_by_company_id',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('classifies the recorded migration with missing column as PARTIALLY_PRESENT', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'ContractLifecycle1792862700000',
        )!;
        expect(entry.recorded).toBe(true);
        expect(entry.status).toBe('PARTIALLY_PRESENT');
        expect(report.proposedPlan.stopAt).toBe(
          'IdentitySchemaBootstrap1749000000000',
        );
      });
    });

    describe('Scenario 6: An unrecorded migration with only some expected objects present', () => {
      const dbName = getDisposableDbName('unrecorded_partial');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            "DELETE FROM migrations WHERE name = 'ContractRoleInvitations1791882600004'",
          );
          await client.query(
            'ALTER TABLE contract_role_invitation DROP CONSTRAINT IF EXISTS ck_contract_role_invitation_workspace',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('classifies the unrecorded migration with missing objects as PARTIALLY_PRESENT', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'ContractRoleInvitations1791882600004',
        )!;
        expect(entry.recorded).toBe(false);
        expect(entry.status).toBe('PARTIALLY_PRESENT');
      });
    });

    describe('Scenario 7: An index with the expected name but incorrect columns', () => {
      const dbName = getDisposableDbName('bad_index_pred');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            'DROP INDEX IF EXISTS ix_company_invitation_company_status_expiry',
          );
          await client.query(
            'CREATE INDEX ix_company_invitation_company_status_expiry ON company_invitation (email)',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails verification when an index has the expected name but incorrect columns', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'CompanyInvitationExpiryIndex1792862700001',
        )!;
        const indexProbe = entry.probes.find(
          (p) => p.id === 'company-invitation-expiry-index-def',
        )!;
        expect(indexProbe.present).toBe(false);
        expect(entry.status).toBe('CONFLICTING_OR_UNKNOWN');
      });
    });

    describe('Scenario 8: The expected expiry index is renamed', () => {
      const dbName = getDisposableDbName('renamed_index');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            'ALTER INDEX ix_company_invitation_company_status_expiry RENAME TO custom_expiry_idx',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('does not treat an unowned alternate name as the migration effect', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'CompanyInvitationExpiryIndex1792862700001',
        )!;
        const indexProbe = entry.probes.find(
          (p) => p.id === 'company-invitation-expiry-index-def',
        )!;
        expect(indexProbe.present).toBe(false);
        expect(entry.status).toBe('CONFLICTING_OR_UNKNOWN');
      });
    });

    describe('Scenario 9: A missing composite foreign key', () => {
      const dbName = getDisposableDbName('missing_comp_fk');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            'ALTER TABLE contract_role_invitation DROP CONSTRAINT fk_contract_role_invitation_party_company',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails verification when a composite foreign key is missing', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'ContractRoleInvitations1791882600004',
        )!;
        const fkProbe = entry.probes.find(
          (p) => p.id === 'role-invitation-foreign-keys',
        )!;
        expect(fkProbe.present).toBe(false);
        expect(entry.status).toBe('PARTIALLY_PRESENT');
      });
    });

    describe('Scenario 10: An enum with an unexpected label or ordering', () => {
      const dbName = getDisposableDbName('bad_enum');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS citext');
          // Create company_user_company_role_enum with missing 'Company Administrator' label
          await client.query(`
          CREATE TYPE "public"."company_user_company_role_enum" AS ENUM(
            'Contractor Project Lead',
            'Contractor Site Supervisor',
            'Client Project Manager',
            'Client Site Engineer',
            'HSE Officer',
            'HSE Manager',
            'Finance Officer',
            'Finance Director'
          )
        `);
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails verification when enum labels or order do not match expected manifest', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'IdentitySchemaBootstrap1749000000000',
        )!;
        const enumProbe = entry.probes.find(
          (p) => p.id === 'identity-enums-and-labels',
        )!;
        expect(enumProbe.present).toBe(false);
      });
    });

    describe('Scenario 11: Incorrect column nullability', () => {
      const dbName = getDisposableDbName('bad_nullability');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(
            'ALTER TABLE company_user ALTER COLUMN left_at SET NOT NULL',
          );
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails verification when column nullability does not match expected state', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'AuthCompanyMembership1760000000000',
        )!;
        const nullProbe = entry.probes.find(
          (p) => p.id === 'auth-nullability-and-defaults',
        )!;
        expect(nullProbe.present).toBe(false);
        expect(entry.status).toBe('PARTIALLY_PRESENT');
      });
    });

    describe('Scenario 12: Missing lifecycle seed data', () => {
      const dbName = getDisposableDbName('missing_seed');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          // Insert a contract without creating workspaces in contract_workspace
          await client.query(`
          INSERT INTO contract (
            id, reference_number, title, description, contract_type, status,
            original_value_minor, current_value_minor, currency_code,
            retention_rate_bps, advance_payment_rate_bps, payment_terms_days,
            liquidated_damages_per_day_minor, award_date, start_date, end_date,
            revised_end_date, actual_completion_date, defects_liability_days, timezone
          ) VALUES (
            '01H00000000000000000000001', 'CN-UNSEEDED-01', 'Unseeded Project',
            'Desc', 'service', 'draft', 1000, 1000, 'USD', 0, 0, 30, 0,
            '2026-01-01', '2026-01-01', '2026-12-31', '2026-12-31', '2026-12-31',
            0, 'UTC'
          )
        `);
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('fails verification when required lifecycle workspace seed data is missing', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'ContractLifecycle1792862700000',
        )!;
        const seedProbe = entry.probes.find(
          (p) => p.id === 'contract-lifecycle-workspace-seed-data',
        )!;
        expect(seedProbe.present).toBe(false);
        expect(entry.status).toBe('PARTIALLY_PRESENT');
      });
    });

    describe('Scenario 13: A database whose migration-history table contradicts the schema', () => {
      const dbName = getDisposableDbName('contradicting_hist');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(`
          CREATE TABLE migrations (
            id SERIAL PRIMARY KEY,
            timestamp BIGINT NOT NULL,
            name VARCHAR NOT NULL
          )
        `);
          await client.query(`
          INSERT INTO migrations (timestamp, name) VALUES
          (1749000000000, 'IdentitySchemaBootstrap1749000000000')
        `);
        } finally {
          await client.end();
        }
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('classifies recorded migration with no schema objects as CONFLICTING_OR_UNKNOWN', async () => {
        const report = await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const entry = report.migrations.find(
          (m) => m.name === 'IdentitySchemaBootstrap1749000000000',
        )!;
        expect(entry.recorded).toBe(true);
        expect(entry.status).toBe('CONFLICTING_OR_UNKNOWN');
      });
    });

    describe('Scenario 14: Planner configuration fails closed before connecting', () => {
      it('requires an explicit recovery target', async () => {
        await expect(
          planMigrationRecovery({ recoveryUrl: '' }),
        ).rejects.toThrow(/Set MIGRATION_RECOVERY_DATABASE_URL/i);
      });
    });

    describe('Scenario 15: Enforcement of read-only database inspection', () => {
      const dbName = getDisposableDbName('readonly_proof');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('leaves captured schema structure and migration history unchanged', async () => {
        const snapshotBefore = await captureSnapshot(targetUrl);
        await planMigrationRecovery({
          recoveryUrl: targetUrl,
          databaseUrl:
            'postgresql://postgres:contractflow@127.0.0.1:5432/other_dev_db',
        });
        const snapshotAfter = await captureSnapshot(targetUrl);

        expect(snapshotsEqual(snapshotAfter, snapshotBefore)).toBe(true);
      });
    });

    describe('Scenario 16: Full chain with migration precondition fixtures', () => {
      const dbName = getDisposableDbName('migration_fixtures');
      let targetUrl: string;

      beforeAll(async () => {
        targetUrl = await createDisposableDatabase(dbName);
        await runTypeormMigrations(targetUrl, registeredMigrations.slice(0, 2));

        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          await client.query(`
          INSERT INTO company (
            id, name, legal_name, registration_number, tax_identification_number,
            email, phone_number, website, address_line1, address_line2, city,
            state_region, postal_code, country_code, default_currency_code, status
          ) VALUES
            ('00000000000000000000000001', 'Fixture A', 'Fixture A Ltd', 'FIX-A',
             'TAX-A', 'fixture-a@example.test', '0000000000', '', '1 Test Road',
             '', 'Test City', 'Test Region', '00000', 'US', 'USD', 'active'),
            ('00000000000000000000000002', 'Fixture B', 'Fixture B Ltd', 'FIX-B',
             'TAX-B', 'fixture-b@example.test', '0000000000', '', '2 Test Road',
             '', 'Test City', 'Test Region', '00000', 'US', 'USD', 'active')
        `);
          await client.query(`
          INSERT INTO app_user (
            id, email, first_name, last_name, middle_name, phone_number,
            password_hash, is_platform_admin, mfa_enabled, timezone,
            email_verified_at, last_login_at
          ) VALUES
            ('00000000000000000000000011', 'user-a@example.test', 'User', 'A',
             '', '0000000000', 'synthetic-only', false, false, 'UTC', now(), now()),
            ('00000000000000000000000012', 'user-b@example.test', 'User', 'B',
             '', '0000000000', 'synthetic-only', false, false, 'UTC', now(), now())
        `);
          await client.query(`
          INSERT INTO company_user (
            id, company_id, user_id, company_role, job_title, status, joined_at, left_at
          ) VALUES
            ('00000000000000000000000021', '00000000000000000000000001',
             '00000000000000000000000011', 'Company Administrator',
             'Test administrator', 'active', now(), NULL),
            ('00000000000000000000000022', '00000000000000000000000002',
             '00000000000000000000000012', 'Company Administrator',
             'Test administrator', 'active', now(), NULL)
        `);
          await client.query(`
          INSERT INTO company_invitation (
            id, company_id, invited_by_company_user_id, email, first_name,
            last_name, company_role, token_hash, status, expires_at, accepted_at,
            created_at
          ) VALUES
            ('00000000000000000000000031', '00000000000000000000000001',
             '00000000000000000000000021', 'expired@example.test', 'Expired',
             'Invitation', 'Contractor Project Lead', 'fixture-token-expired',
             'pending', now() - interval '1 day', now(), now() - interval '4 days'),
            ('00000000000000000000000032', '00000000000000000000000001',
             '00000000000000000000000021', 'duplicate@example.test', 'Older',
             'Invitation', 'Contractor Project Lead', 'fixture-token-duplicate-old',
             'pending', now() + interval '30 days', now(), now() - interval '2 days'),
            ('00000000000000000000000033', '00000000000000000000000001',
             '00000000000000000000000021', 'duplicate@example.test', 'Newer',
             'Invitation', 'Contractor Project Lead', 'fixture-token-duplicate-new',
             'pending', now() + interval '30 days', now(), now() - interval '1 day')
        `);
        } finally {
          await client.end();
        }
        await runTypeormMigrations(targetUrl, registeredMigrations.slice(0, 4));

        const domainClient = new Client({ connectionString: targetUrl });
        await domainClient.connect();
        try {
          await domainClient.query(`
          INSERT INTO contract (
            id, reference_number, title, description, contract_type, status,
            original_value_minor, current_value_minor, currency_code,
            retention_rate_bps, advance_payment_rate_bps, payment_terms_days,
            liquidated_damages_per_day_minor, award_date, start_date, end_date,
            revised_end_date, actual_completion_date, defects_liability_days, timezone
          ) VALUES (
            '00000000000000000000000041', 'FIXTURE-CN-01', 'Fixture Contract',
            'Synthetic migration fixture', 'service', 'draft', 1000, 1000, 'USD',
            0, 0, 30, 0, '2026-01-01', '2026-01-01', '2026-12-31',
            '2026-12-31', '2026-12-31', 0, 'UTC'
          )
        `);
          await domainClient.query(`
          INSERT INTO contract_party (
            id, contract_id, company_id, party_type, signatory_first_name,
            signatory_last_name, signatory_title, signed_at
          ) VALUES (
            '00000000000000000000000042', '00000000000000000000000041',
            '00000000000000000000000001', 'contractor', 'Test', 'Signer',
            'Synthetic signer', now()
          )
        `);
          await domainClient.query(
            'ALTER TABLE contract_role_assignment ALTER COLUMN revoked_at DROP NOT NULL',
          );
          await domainClient.query(`
          INSERT INTO contract_role_assignment (
            id, contract_party_id, company_user_id, company_id, contract_role,
            assigned_at, assigned_by_id, revoked_at, revoked_by_id
          ) VALUES
            ('00000000000000000000000051', '00000000000000000000000042',
             '00000000000000000000000021', '00000000000000000000000001',
             'Contractor Project Lead', now(), '00000000000000000000000021', NULL,
             '00000000000000000000000021'),
            ('00000000000000000000000052', '00000000000000000000000042',
             '00000000000000000000000021', '00000000000000000000000001',
             'Contractor Project Lead', now(), '00000000000000000000000021', NULL,
             '00000000000000000000000021')
        `);
        } finally {
          await domainClient.end();
        }

        await expect(runTypeormMigrations(targetUrl)).rejects.toThrow(
          /duplicate assignments exist/i,
        );
        const duplicateClient = new Client({ connectionString: targetUrl });
        await duplicateClient.connect();
        try {
          await duplicateClient.query(
            `DELETE FROM contract_role_assignment WHERE id = '00000000000000000000000052'`,
          );
        } finally {
          await duplicateClient.end();
        }
        await runTypeormMigrations(targetUrl, registeredMigrations.slice(0, 6));

        const crossCompanyClient = new Client({ connectionString: targetUrl });
        await crossCompanyClient.connect();
        try {
          await crossCompanyClient.query(`
          INSERT INTO contract_role_assignment (
            id, contract_party_id, company_user_id, company_id, contract_role,
            assigned_at, assigned_by_id, revoked_at, revoked_by_id
          ) VALUES (
            '00000000000000000000000053', '00000000000000000000000042',
            '00000000000000000000000022', '00000000000000000000000001',
            'HSE Officer', now(), '00000000000000000000000021', NULL, NULL
          )
        `);
        } finally {
          await crossCompanyClient.end();
        }
        await expect(runTypeormMigrations(targetUrl)).rejects.toThrow(
          /cross-company assignments/i,
        );
        const cleanupClient = new Client({ connectionString: targetUrl });
        await cleanupClient.connect();
        try {
          await cleanupClient.query(
            `DELETE FROM contract_role_assignment WHERE id = '00000000000000000000000053'`,
          );
        } finally {
          await cleanupClient.end();
        }
        await runTypeormMigrations(targetUrl);
      }, DB_TIMEOUT);

      afterAll(async () => {
        await dropDisposableDatabase(dbName);
      }, DB_TIMEOUT);

      it('verifies transformation fixtures and lifecycle/catalog effects after all eleven registered migrations', async () => {
        const client = new Client({ connectionString: targetUrl });
        await client.connect();
        try {
          const ledger = await client.query(
            'SELECT name FROM migrations ORDER BY timestamp, id',
          );
          expect(ledger.rows.map(({ name }) => name)).toEqual(
            registeredMigrations.map((Migration) => new Migration().name),
          );

          const invitationStatuses = await client.query(`
          SELECT email::text AS email, status
          FROM company_invitation
          WHERE id IN (
            '00000000000000000000000031',
            '00000000000000000000000032',
            '00000000000000000000000033'
          )
          ORDER BY id
        `);
          expect(invitationStatuses.rows).toEqual([
            { email: 'expired@example.test', status: 'expired' },
            { email: 'duplicate@example.test', status: 'expired' },
            { email: 'duplicate@example.test', status: 'pending' },
          ]);

          const lifecycleColumns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'contract'
            AND column_name IN (
              'created_by_company_id', 'deleted_at', 'deleted_by_company_user_id'
            )
          ORDER BY column_name
        `);
          expect(lifecycleColumns.rows).toEqual([
            {
              column_name: 'created_by_company_id',
              data_type: 'character varying',
              is_nullable: 'YES',
            },
            {
              column_name: 'deleted_at',
              data_type: 'timestamp with time zone',
              is_nullable: 'YES',
            },
            {
              column_name: 'deleted_by_company_user_id',
              data_type: 'character varying',
              is_nullable: 'YES',
            },
          ]);

          const nullableColumns = await client.query(`
          SELECT table_name, column_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (table_name, column_name) IN (
              ('contract', 'description'),
              ('contract', 'advance_payment_rate_bps'),
              ('contract', 'liquidated_damages_per_day_minor'),
              ('contract', 'revised_end_date'),
              ('contract', 'actual_completion_date'),
              ('contract_party', 'signatory_first_name'),
              ('contract_party', 'signatory_last_name'),
              ('contract_party', 'signatory_title'),
              ('contract_party', 'signed_at'),
              ('contract_status_history', 'from_status'),
              ('contract_status_history', 'reason')
            )
        `);
          expect(nullableColumns.rows).toHaveLength(11);
          expect(
            nullableColumns.rows.every(
              ({ is_nullable }) => is_nullable === 'YES',
            ),
          ).toBe(true);

          const workspaceRows = await client.query(`
          SELECT workspace FROM contract_workspace
          WHERE contract_id = '00000000000000000000000041'
          ORDER BY workspace
        `);
          expect(workspaceRows.rows.map(({ workspace }) => workspace)).toEqual([
            'finance',
            'hse',
            'project',
          ]);

          const constraints = await client.query(`
          SELECT conname FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND conname IN (
              'fk_contract_created_by_company',
              'fk_contract_deleted_by_company_user',
              'ck_contract_workspace_type',
              'fk_contract_workspace_contract',
              'fk_role_assignment_party_company',
              'fk_role_assignment_member_company',
              'ck_contract_role_invitation_workspace',
              'ck_contract_role_invitation_status',
              'fk_contract_role_invitation_party_company',
              'fk_contract_role_invitation_inviter_company',
              'ck_contract_party_invitation_type',
              'ck_contract_party_invitation_status',
              'fk_contract_party_invitation_source',
              'fk_contract_party_invitation_inviter'
            )
        `);
          expect(constraints.rows.map(({ conname }) => conname)).toEqual(
            expect.arrayContaining([
              'fk_contract_created_by_company',
              'fk_contract_deleted_by_company_user',
              'ck_contract_workspace_type',
              'fk_contract_workspace_contract',
              'fk_role_assignment_party_company',
              'fk_role_assignment_member_company',
              'ck_contract_role_invitation_workspace',
              'ck_contract_role_invitation_status',
              'fk_contract_role_invitation_party_company',
              'fk_contract_role_invitation_inviter_company',
              'ck_contract_party_invitation_type',
              'ck_contract_party_invitation_status',
              'fk_contract_party_invitation_source',
              'fk_contract_party_invitation_inviter',
            ]),
          );

          const indexes = await client.query(`
          SELECT indexname, indexdef FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (
              'uq_contract_role_assignment_active',
              'uq_contract_role_invitation_token',
              'uq_contract_role_invitation_pending',
              'ix_contract_role_invitation_party_status_expiry',
              'uq_contract_party_invitation_token',
              'uq_contract_party_invitation_pending',
              'ix_contract_party_invitation_target_status',
              'ix_contract_status_history_contract_changed',
              'ix_company_invitation_company_status_expiry'
            )
        `);
          expect(indexes.rows).toHaveLength(9);
          expect(
            indexes.rows.find(
              ({ indexname }) =>
                indexname === 'uq_contract_role_assignment_active',
            )?.indexdef,
          ).toMatch(/UNIQUE.*WHERE \(revoked_at IS NULL\)/i);
          expect(
            indexes.rows.find(
              ({ indexname }) =>
                indexname === 'ix_company_invitation_company_status_expiry',
            )?.indexdef,
          ).toMatch(/company_id.*status.*expires_at/i);
        } finally {
          await client.end();
        }
      });
    });

    describe('Database isolation and target identity validation', () => {
      it('refuses to plan when recoveryUrl matches configured databaseUrl across host aliases and default ports', () => {
        const dev = 'postgresql://user:pass@localhost:5432/cf_db';
        const same127 = 'postgresql://planner:secret@127.0.0.1:5432/cf_db';
        const sameIpv6 = 'postgresql://planner:secret@[::1]:5432/cf_db';
        const sameNoPort = 'postgresql://planner:secret@localhost/cf_db/';

        expect(isSameDatabaseTarget(dev, same127)).toBe(true);
        expect(isSameDatabaseTarget(dev, sameIpv6)).toBe(true);
        expect(isSameDatabaseTarget(dev, sameNoPort)).toBe(true);
      });

      it('rejects planning when recoveryUrl matches databaseUrl', async () => {
        await expect(
          planMigrationRecovery({
            recoveryUrl:
              'postgresql://postgres:pass@localhost:5432/contractflow_dev',
            databaseUrl:
              'postgresql://postgres:pass@127.0.0.1:5432/contractflow_dev',
          }),
        ).rejects.toThrow(
          /Refusing to plan against the configured DATABASE_URL target/i,
        );
      });

      it('throws when target identity cannot be verified reliably', async () => {
        await expect(
          planMigrationRecovery({
            recoveryUrl: 'postgresql://localhost/',
          }),
        ).rejects.toThrow(/Database name is missing/i);
      });

      it('throws when recovery target URL is omitted', async () => {
        await expect(
          planMigrationRecovery({
            recoveryUrl: '',
          }),
        ).rejects.toThrow(
          /Set MIGRATION_RECOVERY_DATABASE_URL to the deliberate planning target/i,
        );
      });
    });
  },
);
