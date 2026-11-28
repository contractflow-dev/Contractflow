import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { registeredMigrations } from '../src/common/database/registered-migrations';
import { ContractPartyRules1794000000003 } from '../src/common/database/migrations/1794000000003-contract-party-rules';
import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
} from './helpers/disposable-postgres-safety';

/**
 * Runs ContractPartyRules1794000000003 up and down on a real PostgreSQL
 * database created for this file alone. Opt-in, like the other migration
 * suites: it needs the disposable PostgreSQL environment variables.
 */
const ownedDatabases = new Set<string>();

async function createDatabase(): Promise<{ name: string; url: string }> {
  const rootUrl = getDisposablePostgresUrl(process.env);
  const name = `cf_plan_test_party_rules_${randomUUID().replace(/-/g, '')}`;
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
  'ContractPartyRules1794000000003 on PostgreSQL',
  () => {
    let database: { name: string; url: string };
    let dataSource: DataSource;
    const migration = new ContractPartyRules1794000000003();

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
    const insertCompany = (id: string) =>
      dataSource.query(
        `INSERT INTO "company"
         ("id", "name", "legal_name", "registration_number",
          "tax_identification_number", "email", "phone_number", "website",
          "address_line1", "address_line2", "city", "state_region",
          "postal_code", "country_code", "default_currency_code", "status")
       VALUES ($1, $1, $1, 'R', 'T', $2, '1', '', 'a', '', 'c', 's', 'p', 'NG',
               'NGN', 'active')`,
        [id, `${id.toLowerCase()}@example.com`],
      );
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
    const insertParty = (
      id: string,
      contract: string,
      company: string,
      type: string,
    ) =>
      dataSource.query(
        `INSERT INTO "contract_party" ("id", "contract_id", "company_id", "party_type")
       VALUES ($1, $2, $3, $4)`,
        [id, contract, company, type],
      );
    const partyCount = async (): Promise<number> => {
      const [{ parties }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS parties FROM "contract_party"`,
      )) as Array<{ parties: number }>;
      return parties;
    };

    beforeAll(async () => {
      database = await createDatabase();
      dataSource = new DataSource({
        type: 'postgres',
        url: database.url,
        // Everything before this migration; the tests apply it by hand.
        migrations: registeredMigrations.slice(
          0,
          registeredMigrations.indexOf(ContractPartyRules1794000000003),
        ),
        synchronize: false,
        migrationsRun: false,
        logging: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      for (const company of ['CLIENT', 'MAINCO', 'SUBCO', 'OTHER']) {
        await insertCompany(company);
      }
      await insertContract('MAIN', null);
      await insertContract('SUB', 'MAIN');
      await insertParty('P_CLIENT', 'MAIN', 'CLIENT', 'awarding');
      await insertParty('P_MAINCO', 'MAIN', 'MAINCO', 'awarded');
      await insertParty('P_SUB_MAINCO', 'SUB', 'MAINCO', 'awarding');
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
      if (database) await dropDatabase(database.name);
    });

    it('refuses while a contract has two awarded parties or the client is on a subcontract', async () => {
      await insertParty('P_EXTRA', 'MAIN', 'OTHER', 'awarded');
      await insertParty('P_SUB_CLIENT', 'SUB', 'CLIENT', 'awarded');
      await expect(
        withRunner((runner) => migration.up(runner)),
      ).rejects.toThrow(/many_awarded: 1, client_on_subcontract: 1/);
      await dataSource.query(
        `DELETE FROM "contract_party" WHERE "id" IN ('P_EXTRA', 'P_SUB_CLIENT')`,
      );
    });

    it('then keeps every contract between two companies, and the client off subcontracts', async () => {
      await withRunner((runner) => migration.up(runner));

      await expect(
        insertParty('P_EXTRA', 'MAIN', 'OTHER', 'awarded'),
      ).rejects.toThrow(/uq_contract_party_one_awarded/);
      await expect(
        insertParty('P_SUB_CLIENT', 'SUB', 'CLIENT', 'awarded'),
      ).rejects.toThrow(/awarding party cannot be a party to its subcontract/);
      await expect(
        insertParty('P_SUB_TWICE', 'SUB', 'MAINCO', 'awarded'),
      ).rejects.toThrow(/uq_contract_party_contract_company/);
      // The subcontractor joins as the awarded party.
      await insertParty('P_SUB_SUBCO', 'SUB', 'SUBCO', 'awarded');
      expect(await partyCount()).toBe(4);
    });

    it('rolls back the rules without touching any party', async () => {
      await withRunner((runner) => migration.down(runner));
      await insertParty('P_EXTRA', 'MAIN', 'OTHER', 'awarded');
      expect(await partyCount()).toBe(5);
    });
  },
);
