import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { UlidEntityReferences1794000000000 } from '../src/common/database/migrations/1794000000000-ulid-entity-references';
import { ContractStatusHistoryValues1794000000001 } from '../src/common/database/migrations/1794000000001-contract-status-history-values';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs UlidEntityReferences1794000000000 and
 * ContractStatusHistoryValues1794000000001 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the other migration
 * suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_ulid_${randomUUID().replace(/-/g, '')}`;
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

const ULID = '01JD4X2Y3Z4A5B6C7D8E9F0G1H';
const UUID = '0b1e3b9c-4f2a-4c1e-9a61-2f8d7c1b5e10';
const OLD_STATUS_LABELS = [
  'draft',
  'active',
  'suspended',
  'completed',
  'cancelled',
  'under_review',
];
const NEW_STATUS_LABELS = ['draft', 'active', 'suspended', 'completed'];

const describeDisposablePostgres = hasDisposablePostgresTestConfiguration(
  process.env,
)
  ? describe
  : describe.skip;

describeDisposablePostgres(
  'ULID entity references and contract status history values on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const ulidMigration = new UlidEntityReferences1794000000000();
    const statusMigration = new ContractStatusHistoryValues1794000000001();

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
    const columnType = async (table: string): Promise<string> => {
      const [row] = (await dataSource.query(
        `SELECT data_type, character_maximum_length AS length
           FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'entity_id'`,
        [table],
      )) as Array<{ data_type: string; length: number | null }>;
      return row.length ? `${row.data_type}(${row.length})` : row.data_type;
    };
    const labels = async (typeName: string): Promise<string[]> => {
      const rows: Array<{ label: string }> = await dataSource.query(
        `SELECT enumlabel::text AS label FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1 ORDER BY enumsortorder`,
        [typeName],
      );
      return rows.map(({ label }) => label);
    };
    const insertNotification = (id: string, entityId: string) =>
      dataSource.query(
        `INSERT INTO "notification"
           ("id", "recipient_user_id", "contract_id", "notification_type",
            "title", "body", "entity_type", "entity_id", "channel", "sent_at",
            "read_at")
         VALUES ($1, 'USER', 'CONTRACT', 'test', 't', 'b', 'milestone', $2,
                 'email', now(), now())`,
        [id, entityId],
      );
    const insertHistory = (id: string, toStatus: string) =>
      dataSource.query(
        `INSERT INTO "contract_status_history"
           ("id", "contract_id", "from_status", "to_status", "changed_by_id",
            "changed_at")
         VALUES ($1, 'CONTRACT', 'draft', $2, 'MEMBER', now())`,
        [id, toStatus],
      );

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before these migrations; the tests apply them by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(UlidEntityReferences1794000000000),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();

      await withRunner(async (runner) => {
        await runner.query(
          `INSERT INTO "company"
             ("id", "name", "legal_name", "registration_number",
              "tax_identification_number", "email", "phone_number", "website",
              "address_line1", "address_line2", "city", "state_region",
              "postal_code", "country_code", "default_currency_code", "status")
           VALUES ('COMPANY', 'Co', 'Co Ltd', 'R', 'T', 'co@example.com', '1',
                   '', 'a', '', 'c', 's', 'p', 'NG', 'NGN', 'active')`,
        );
        await runner.query(
          `INSERT INTO "app_user"
             ("id", "email", "first_name", "last_name", "middle_name",
              "phone_number", "password_hash", "is_platform_admin",
              "mfa_enabled", "timezone")
           VALUES ('USER', 'user@example.com', 'F', 'L', '', '1', 'x', false,
                   false, 'UTC')`,
        );
        await runner.query(
          `INSERT INTO "company_user"
             ("id", "company_id", "user_id", "company_role", "job_title",
              "status", "joined_at", "left_at")
           VALUES ('MEMBER', 'COMPANY', 'USER', 'Company Administrator', 'A',
                   'active', now(), NULL)`,
        );
        await runner.query(
          `INSERT INTO "contract"
             ("id", "reference_number", "title", "contract_type", "status",
              "original_value_minor", "current_value_minor", "currency_code",
              "retention_rate_bps", "payment_terms_days", "award_date",
              "start_date", "end_date", "defects_liability_days", "timezone",
              "created_by_company_id")
           VALUES ('CONTRACT', 'REF', 'T', 'service', 'draft', 100, 100, 'NGN',
                   0, 30, '2026-01-01', '2026-01-02', '2026-12-31', 0, 'UTC',
                   'COMPANY')`,
        );
      });
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    describe('UlidEntityReferences1794000000000', () => {
      it('refuses while a row holds a UUID reference, changing nothing', async () => {
        await insertNotification('NOTE_UUID', UUID);
        await expect(
          withRunner((runner) => ulidMigration.up(runner)),
        ).rejects.toThrow(/existing rows hold UUIDs .*notification: 1/);
        expect(await columnType('notification')).toBe('uuid');
        await dataSource.query(
          `DELETE FROM "notification" WHERE "id" = 'NOTE_UUID'`,
        );
      });

      it('makes every generic entity_id a ULID column', async () => {
        await withRunner((runner) => ulidMigration.up(runner));
        for (const table of ['comment', 'notification', 'document_link']) {
          expect(await columnType(table)).toBe('character varying(26)');
        }
        await insertNotification('NOTE_ULID', ULID);
        // A UUID no longer fits; a 26-character non-ULID fails the CHECK.
        await expect(insertNotification('NOTE_BAD', UUID)).rejects.toThrow(
          /value too long/,
        );
        await expect(
          insertNotification('NOTE_BAD', '8ZZZZZZZZZZZZZZZZZZZZZZZZZ'),
        ).rejects.toThrow(/ck_notification_entity_id_ulid/);
      });

      it('refuses to roll back while a row holds a ULID, then rolls back to uuid', async () => {
        await expect(
          withRunner((runner) => ulidMigration.down(runner)),
        ).rejects.toThrow(/rows hold ULIDs \(notification: 1\)/);
        await dataSource.query(
          `DELETE FROM "notification" WHERE "id" = 'NOTE_ULID'`,
        );
        await withRunner((runner) => ulidMigration.down(runner));
        for (const table of ['comment', 'notification', 'document_link']) {
          expect(await columnType(table)).toBe('uuid');
        }
      });
    });

    describe('ContractStatusHistoryValues1794000000001', () => {
      it('refuses while history uses a value no contract can have, changing nothing', async () => {
        await insertHistory('HIST_CANCELLED', 'cancelled');
        await expect(
          withRunner((runner) => statusMigration.up(runner)),
        ).rejects.toThrow(/1 contract status history row\(s\) use them/);
        expect(await labels('contract_status_history_to_status_enum')).toEqual(
          OLD_STATUS_LABELS,
        );
        await dataSource.query(
          `DELETE FROM "contract_status_history" WHERE "id" = 'HIST_CANCELLED'`,
        );
      });

      it('keeps history and allows only the four contract statuses', async () => {
        await insertHistory('HIST_ACTIVE', 'active');
        await withRunner((runner) => statusMigration.up(runner));

        for (const typeName of [
          'contract_status_history_from_status_enum',
          'contract_status_history_to_status_enum',
        ]) {
          expect(await labels(typeName)).toEqual(NEW_STATUS_LABELS);
        }
        const [kept] = (await dataSource.query(
          `SELECT "from_status"::text AS "from", "to_status"::text AS "to"
             FROM "contract_status_history" WHERE "id" = 'HIST_ACTIVE'`,
        )) as Array<{ from: string; to: string }>;
        expect(kept).toEqual({ from: 'draft', to: 'active' });
        await expect(insertHistory('HIST_BAD', 'archived')).rejects.toThrow(
          /invalid input value for enum/,
        );
      });

      it('rolls back to the earlier labels, keeping history', async () => {
        await withRunner((runner) => statusMigration.down(runner));
        expect(await labels('contract_status_history_to_status_enum')).toEqual(
          OLD_STATUS_LABELS,
        );
        const [{ rows }] = (await dataSource.query(
          `SELECT COUNT(*)::int AS rows FROM "contract_status_history"`,
        )) as Array<{ rows: number }>;
        expect(rows).toBe(1);
      });
    });
  },
);
