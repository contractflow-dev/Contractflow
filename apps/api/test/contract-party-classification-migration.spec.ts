import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { ContractPartyClassification1793900000000 } from '../src/common/database/migrations/1793900000000-contract-party-classification';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs ContractPartyClassification1793900000000 up and down on a real
 * PostgreSQL database created for this file alone. Opt-in, like the other
 * migration suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_parties_${randomUUID().replace(/-/g, '')}`;
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

const OLD_LABELS = ['client', 'contractor', 'subcontractor', 'vendor', 'other'];

/**
 * Parties before the migration, and what each must become:
 * - MAIN (created by CLIENTCO, no parent): the client is awarding; the
 *   contractor, vendor and other parties are awarded.
 * - SUB (created by MAINCO with MAIN as its parent): MAINCO's own party was
 *   stored as `contractor` but awards the subcontract, so it becomes
 *   awarding; the subcontractor is awarded.
 * - SOLO (created by MAINCO, no parent, typed contractor): no client on the
 *   platform, so nobody is awarding.
 */
const PARTIES: Array<
  [id: string, contract: string, company: string, before: string, after: string]
> = [
  ['P_MAIN_CLIENT', 'MAIN', 'CLIENTCO', 'client', 'awarding'],
  ['P_MAIN_CONTRACTOR', 'MAIN', 'MAINCO', 'contractor', 'awarded'],
  ['P_MAIN_VENDOR', 'MAIN', 'VENDORCO', 'vendor', 'awarded'],
  ['P_MAIN_OTHER', 'MAIN', 'OTHERCO', 'other', 'awarded'],
  ['P_SUB_MAIN', 'SUB', 'MAINCO', 'contractor', 'awarding'],
  ['P_SUB_SUBCO', 'SUB', 'SUBCO', 'subcontractor', 'awarded'],
  ['P_SOLO_MAIN', 'SOLO', 'MAINCO', 'contractor', 'awarded'],
];

const describeDisposablePostgres = hasDisposablePostgresTestConfiguration(
  process.env,
)
  ? describe
  : describe.skip;

describeDisposablePostgres(
  'ContractPartyClassification1793900000000 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new ContractPartyClassification1793900000000();

    const labels = async (): Promise<string[]> => {
      const rows: Array<{ label: string }> = await dataSource.query(
        `SELECT enumlabel::text AS label FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'contract_party_party_type_enum'
        ORDER BY enumsortorder`,
      );
      return rows.map(({ label }) => label);
    };
    const partyTypes = async (
      table: string,
    ): Promise<Record<string, string>> => {
      const rows: Array<{ id: string; type: string }> = await dataSource.query(
        `SELECT "id", "party_type"::text AS type FROM "${table}" ORDER BY "id"`,
      );
      return Object.fromEntries(rows.map(({ id, type }) => [id, type]));
    };
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
    const insertContract = (
      runner: ReturnType<DataSource['createQueryRunner']>,
      id: string,
      createdBy: string,
      parent: string | null,
    ) =>
      runner.query(
        `INSERT INTO "contract"
           ("id", "reference_number", "title", "contract_type", "status",
            "parent_contract_id", "original_value_minor", "current_value_minor",
            "currency_code", "retention_rate_bps", "payment_terms_days",
            "award_date", "start_date", "end_date", "defects_liability_days",
            "timezone", "created_by_company_id")
         VALUES ($1, $1, $1, 'service', 'draft', $2, 100, 100, 'NGN', 0, 30,
                 '2026-01-01', '2026-01-02', '2026-12-31', 0, 'UTC', $3)`,
        [id, parent, createdBy],
      );

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the test applies it by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(
            ContractPartyClassification1793900000000,
          ),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();

      await withRunner(async (runner) => {
        for (const company of [
          'CLIENTCO',
          'MAINCO',
          'VENDORCO',
          'OTHERCO',
          'SUBCO',
          'LATECO',
        ]) {
          await runner.query(
            `INSERT INTO "company"
               ("id", "name", "legal_name", "registration_number",
                "tax_identification_number", "email", "phone_number", "website",
                "address_line1", "address_line2", "city", "state_region",
                "postal_code", "country_code", "default_currency_code", "status")
             VALUES ($1, $1, $1, 'R', 'T', $2, '1', '', 'a', '', 'c', 's', 'p',
                     'NG', 'NGN', 'active')`,
            [company, `${company.toLowerCase()}@example.com`],
          );
        }
        await runner.query(
          `INSERT INTO "app_user"
             ("id", "email", "first_name", "last_name", "middle_name",
              "phone_number", "password_hash", "is_platform_admin",
              "mfa_enabled", "timezone")
           VALUES ('USERMAIN', 'main@example.com', 'F', 'L', '', '1', 'x',
                   false, false, 'UTC')`,
        );
        await runner.query(
          `INSERT INTO "company_user"
             ("id", "company_id", "user_id", "company_role", "job_title",
              "status", "joined_at", "left_at")
           VALUES ('CUMAIN', 'MAINCO', 'USERMAIN', 'Company Administrator',
                   'Admin', 'active', now(), NULL)`,
        );
        await insertContract(runner, 'MAIN', 'CLIENTCO', null);
        await insertContract(runner, 'SUB', 'MAINCO', 'MAIN');
        await insertContract(runner, 'SOLO', 'MAINCO', null);
        for (const [id, contract, company, before] of PARTIES) {
          await runner.query(
            `INSERT INTO "contract_party"
               ("id", "contract_id", "company_id", "party_type")
             VALUES ($1, $2, $3, $4)`,
            [id, contract, company, before],
          );
        }
        // A pending subcontractor invitation and a past contractor one.
        await runner.query(
          `INSERT INTO "contract_party_invitation"
             ("id", "source_contract_party_id", "source_company_id",
              "target_company_id", "invited_by_company_user_id", "party_type",
              "email", "token_hash", "status", "expires_at")
           VALUES
             ('INV_PENDING', 'P_SUB_MAIN', 'MAINCO', 'LATECO', 'CUMAIN',
              'subcontractor', 'lateco@example.com', 'hash-1', 'pending',
              now() + interval '1 day'),
             ('INV_EXPIRED', 'P_SUB_MAIN', 'MAINCO', 'LATECO', 'CUMAIN',
              'contractor', 'lateco@example.com', 'hash-2', 'expired',
              now() - interval '1 day')`,
        );
      });
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('refuses to migrate when a contract would get two awarding parties, changing nothing', async () => {
      // A client party on the subcontract as well as its creator.
      await dataSource.query(
        `INSERT INTO "contract_party" ("id", "contract_id", "company_id", "party_type")
         VALUES ('P_SUB_CLIENT', 'SUB', 'CLIENTCO', 'client')`,
      );
      await expect(
        withRunner((runner) => migration.up(runner)),
      ).rejects.toThrow(/1 contract\(s\) would have more than one awarding/);
      expect(await labels()).toEqual(OLD_LABELS);
      await dataSource.query(
        `DELETE FROM "contract_party" WHERE "id" = 'P_SUB_CLIENT'`,
      );
    });

    it('classifies every party as awarding or awarded and backs up the old types', async () => {
      await withRunner((runner) => migration.up(runner));

      expect(await labels()).toEqual(['awarding', 'awarded']);
      expect(await partyTypes('contract_party')).toEqual(
        Object.fromEntries(PARTIES.map(([id, , , , after]) => [id, after])),
      );
      expect(await partyTypes('contract_party_invitation')).toEqual({
        INV_EXPIRED: 'awarded',
        INV_PENDING: 'awarded',
      });
      const [{ backups }] = await dataSource.query(
        `SELECT COUNT(*)::int AS backups FROM "migration_contract_party_type_backup"`,
      );
      expect(backups).toBe(PARTIES.length + 2);
    });

    it('rejects old values and a second awarding party', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "contract_party" ("id", "contract_id", "company_id", "party_type")
           VALUES ('P_BAD', 'SOLO', 'SUBCO', 'subcontractor')`,
        ),
      ).rejects.toThrow(/invalid input value for enum/);
      await expect(
        dataSource.query(
          `INSERT INTO "contract_party" ("id", "contract_id", "company_id", "party_type")
           VALUES ('P_BAD', 'MAIN', 'SUBCO', 'awarding')`,
        ),
      ).rejects.toThrow(/uq_contract_party_one_awarding/);
      await expect(
        dataSource.query(
          `UPDATE "contract_party_invitation" SET "party_type" = 'contractor'
            WHERE "id" = 'INV_EXPIRED'`,
        ),
      ).rejects.toThrow(/ck_contract_party_invitation_type/);
    });

    it('refuses to roll back while a party has no earlier type, changing nothing', async () => {
      await dataSource.query(
        `INSERT INTO "contract_party" ("id", "contract_id", "company_id", "party_type")
         VALUES ('P_LATE', 'SOLO', 'LATECO', 'awarded')`,
      );
      await expect(
        withRunner((runner) => migration.down(runner)),
      ).rejects.toThrow(/1 party row\(s\) and 0 invitation\(s\)/);
      expect(await labels()).toEqual(['awarding', 'awarded']);
      await dataSource.query(
        `DELETE FROM "contract_party" WHERE "id" = 'P_LATE'`,
      );
    });

    it('rolls back to the exact earlier party types', async () => {
      await withRunner((runner) => migration.down(runner));

      expect(await labels()).toEqual(OLD_LABELS);
      expect(await partyTypes('contract_party')).toEqual(
        Object.fromEntries(PARTIES.map(([id, , , before]) => [id, before])),
      );
      expect(await partyTypes('contract_party_invitation')).toEqual({
        INV_EXPIRED: 'contractor',
        INV_PENDING: 'subcontractor',
      });
      const [{ backup }] = await dataSource.query(
        `SELECT to_regclass('migration_contract_party_type_backup') IS NULL AS backup`,
      );
      expect(backup).toBe(true);
    });
  },
);
