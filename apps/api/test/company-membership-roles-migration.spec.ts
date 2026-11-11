import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { CompanyMembershipRoles1793600000000 } from '../src/common/database/migrations/1793600000000-company-membership-roles';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs CompanyMembershipRoles1793600000000 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the recovery-planner
 * suite: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_roles_${randomUUID().replace(/-/g, '')}`;
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

const OLD_MEMBER_LABELS = [
  'Contractor Project Lead',
  'Contractor Site Supervisor',
  'Client Project Manager',
  'Client Site Engineer',
  'HSE Officer',
  'HSE Manager',
  'Finance Officer',
  'Finance Director',
  'Company Administrator',
];

const describeDisposablePostgres = hasDisposablePostgresTestConfiguration(
  process.env,
)
  ? describe
  : describe.skip;

describeDisposablePostgres(
  'CompanyMembershipRoles1793600000000 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new CompanyMembershipRoles1793600000000();

    const labels = async (typeName: string): Promise<string[]> => {
      const rows: Array<{ label: string }> = await dataSource.query(
        `SELECT enumlabel::text AS label FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1 ORDER BY enumsortorder`,
        [typeName],
      );
      return rows.map(({ label }) => label);
    };
    const roles = async (table: string): Promise<Record<string, string>> => {
      const rows: Array<{ id: string; role: string }> = await dataSource.query(
        `SELECT "id", "company_role"::text AS role FROM "${table}" ORDER BY "id"`,
      );
      return Object.fromEntries(rows.map(({ id, role }) => [id, role]));
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

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the test applies it by hand.
        migrations: registeredMigrations.filter(
          (item) => item !== CompanyMembershipRoles1793600000000,
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
        for (const id of [...OLD_MEMBER_LABELS.keys(), 'NEW']) {
          await runner.query(
            `INSERT INTO "app_user"
               ("id", "email", "first_name", "last_name", "middle_name",
                "phone_number", "password_hash", "is_platform_admin",
                "mfa_enabled", "timezone")
             VALUES ($1, $2, 'F', 'L', '', '1', 'x', false, false, 'UTC')`,
            [`USER${id}`, `user${id}@example.com`],
          );
        }
        for (const [index, role] of OLD_MEMBER_LABELS.entries()) {
          await runner.query(
            `INSERT INTO "company_user"
             ("id", "company_id", "user_id", "company_role", "job_title",
              "status", "joined_at", "left_at")
           VALUES ($1, 'COMPANY', $2, $3, $4, 'active', now(), NULL)`,
            [`CU${index}`, `USER${index}`, role, `Title ${index}`],
          );
        }
        await runner.query(
          `INSERT INTO "company_invitation"
           ("id", "company_id", "invited_by_company_user_id", "email",
            "first_name", "last_name", "company_role", "token_hash",
            "status", "expires_at", "accepted_at", "revoked_at")
         VALUES
           ('INV1', 'COMPANY', 'CU8', 'a@example.com', NULL, NULL,
            'HSE Officer', 'hash-1', 'pending', now() + interval '1 day', NULL, NULL),
           ('INV2', 'COMPANY', 'CU8', 'b@example.com', NULL, NULL,
            'Client Project Manager', 'hash-2', 'accepted', now(), now(), NULL)`,
        );
      });
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('keeps administrators, makes everyone else a Member, and backs up the old labels', async () => {
      await withRunner((runner) => migration.up(runner));

      expect(await labels('company_user_company_role_enum')).toEqual([
        'Company Administrator',
        'Member',
      ]);
      expect(await labels('company_invitation_company_role_enum')).toEqual([
        'Company Administrator',
        'Member',
      ]);
      const members = await roles('company_user');
      expect(members.CU8).toBe('Company Administrator');
      for (let index = 0; index < 8; index += 1) {
        expect(members[`CU${index}`]).toBe('Member');
      }
      expect(await roles('company_invitation')).toEqual({
        INV1: 'Member',
        INV2: 'Member',
      });
      // Job titles and every other column are left alone.
      const [{ titles }] = await dataSource.query(
        `SELECT COUNT(*)::int AS titles FROM "company_user" WHERE "job_title" LIKE 'Title %'`,
      );
      expect(titles).toBe(9);
      const [{ backups }] = await dataSource.query(
        `SELECT COUNT(*)::int AS backups FROM "migration_company_role_backup"`,
      );
      expect(backups).toBe(10);
    });

    it('refuses to roll back while a Member has no earlier role, changing nothing', async () => {
      await dataSource.query(
        `INSERT INTO "company_user"
         ("id", "company_id", "user_id", "company_role", "job_title",
          "status", "joined_at", "left_at")
       VALUES ('CUNEW', 'COMPANY', 'USERNEW', 'Member', 'Joined later',
               'active', now(), NULL)`,
      );

      await expect(
        withRunner((runner) => migration.down(runner)),
      ).rejects.toThrow(/1 member\(s\) and 0 invitation\(s\)/);
      expect(await labels('company_user_company_role_enum')).toEqual([
        'Company Administrator',
        'Member',
      ]);

      await dataSource.query(`DELETE FROM "company_user" WHERE "id" = 'CUNEW'`);
    });

    it('refuses to roll back an administrator invitation', async () => {
      await dataSource.query(
        `UPDATE "company_invitation" SET "company_role" = 'Company Administrator' WHERE "id" = 'INV1'`,
      );
      await expect(
        withRunner((runner) => migration.down(runner)),
      ).rejects.toThrow(/0 member\(s\) and 1 invitation\(s\)/);
      await dataSource.query(
        `UPDATE "company_invitation" SET "company_role" = 'Member' WHERE "id" = 'INV1'`,
      );
    });

    it('rolls back to the exact earlier labels, keeping later promotions', async () => {
      // Promoted after the migration: stays an administrator.
      await dataSource.query(
        `UPDATE "company_user" SET "company_role" = 'Company Administrator' WHERE "id" = 'CU0'`,
      );

      await withRunner((runner) => migration.down(runner));

      expect(await labels('company_user_company_role_enum')).toEqual(
        OLD_MEMBER_LABELS,
      );
      expect(await labels('company_invitation_company_role_enum')).toEqual(
        OLD_MEMBER_LABELS.slice(0, 8),
      );
      const members = await roles('company_user');
      expect(members.CU0).toBe('Company Administrator');
      for (let index = 1; index < 9; index += 1) {
        expect(members[`CU${index}`]).toBe(OLD_MEMBER_LABELS[index]);
      }
      expect(await roles('company_invitation')).toEqual({
        INV1: 'HSE Officer',
        INV2: 'Client Project Manager',
      });
      const [{ present }] = await dataSource.query(
        `SELECT to_regclass('migration_company_role_backup') IS NOT NULL AS present`,
      );
      expect(present).toBe(false);
    });

    it('applies again cleanly after a rollback', async () => {
      await withRunner((runner) => migration.up(runner));
      const members = await roles('company_user');
      expect(members.CU0).toBe('Company Administrator');
      expect(members.CU1).toBe('Member');
      expect(members.CU8).toBe('Company Administrator');
    });
  },
);
