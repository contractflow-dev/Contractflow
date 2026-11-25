import type { MigrationInterface, QueryRunner } from 'typeorm';

const ONE_PARTY_PER_COMPANY = 'uq_contract_party_contract_company';
const ONE_AWARDED_INDEX = 'uq_contract_party_one_awarded';
const RULES_FUNCTION = 'contract_party_rules';
const RULES_TRIGGER = 'contract_party_rules';

/**
 * Every contract is between exactly two companies: one AWARDING party and one
 * AWARDED party. On a main contract the client awards it to the contractor;
 * on a subcontract the contractor awards it to a subcontractor. The main
 * contract's client is never a party to a subcontract, and a subcontractor
 * is never a party to the main contract.
 *
 * At most one AWARDING party per contract already exists
 * (uq_contract_party_one_awarding). This adds:
 * - At most one AWARDED party per contract.
 * - At most one party row per company per contract, so no company is both
 *   parties of one contract.
 * - A trigger for the subcontract rules that span two contracts: the
 *   subcontract's AWARDING party is the main contract's AWARDED party, and
 *   the main contract's AWARDING party (the client) can't be a party to it.
 *
 * "Exactly one" is completed over time: a contract is created with its
 * creating company's party, and the other joins by accepting an invitation.
 *
 * The migration changes no data. It refuses, and reports how many rows,
 * when existing parties already break one of these rules.
 */
export class ContractPartyRules1794000000003 implements MigrationInterface {
  name = 'ContractPartyRules1794000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [found] = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::int FROM (
          SELECT 1 FROM "contract_party"
           GROUP BY "contract_id", "company_id" HAVING COUNT(*) > 1
        ) AS repeated) AS repeated_companies,
        (SELECT COUNT(*)::int FROM (
          SELECT 1 FROM "contract_party" WHERE "party_type" = 'awarded'
           GROUP BY "contract_id" HAVING COUNT(*) > 1
        ) AS awarded) AS many_awarded,
        (SELECT COUNT(*)::int FROM "contract_party" child
           JOIN "contract" c ON c."id" = child."contract_id"
          WHERE c."parent_contract_id" IS NOT NULL
            AND child."party_type" = 'awarding'
            AND NOT EXISTS (
              SELECT 1 FROM "contract_party" main
               WHERE main."contract_id" = c."parent_contract_id"
                 AND main."company_id" = child."company_id"
                 AND main."party_type" = 'awarded')) AS wrong_awarding,
        (SELECT COUNT(*)::int FROM "contract_party" child
           JOIN "contract" c ON c."id" = child."contract_id"
           JOIN "contract_party" main
             ON main."contract_id" = c."parent_contract_id"
            AND main."company_id" = child."company_id"
            AND main."party_type" = 'awarding') AS client_on_subcontract
    `)) as Array<Record<string, number>>;
    const problems = Object.entries(found).filter(
      ([, count]) => Number(count) > 0,
    );
    if (problems.length > 0) {
      throw new Error(
        'Cannot enforce one awarding and one awarded party per contract: ' +
          problems.map(([rule, count]) => `${rule}: ${count}`).join(', ') +
          '. Resolve them deliberately before migrating.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "contract_party" ADD CONSTRAINT "${ONE_PARTY_PER_COMPANY}"
        UNIQUE ("contract_id", "company_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "${ONE_AWARDED_INDEX}"
        ON "contract_party" ("contract_id")
        WHERE "party_type" = 'awarded'
    `);
    await queryRunner.query(`
      CREATE FUNCTION "${RULES_FUNCTION}"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        main_contract_id character varying(26);
      BEGIN
        SELECT "parent_contract_id" INTO main_contract_id
          FROM "contract" WHERE "id" = NEW."contract_id";
        IF main_contract_id IS NULL THEN
          RETURN NEW;
        END IF;
        IF NEW."party_type" = 'awarding' AND NOT EXISTS (
          SELECT 1 FROM "contract_party"
           WHERE "contract_id" = main_contract_id
             AND "company_id" = NEW."company_id"
             AND "party_type" = 'awarded'
        ) THEN
          RAISE EXCEPTION 'A subcontract''s awarding party must be the main contract''s awarded party.'
            USING ERRCODE = 'check_violation';
        END IF;
        IF EXISTS (
          SELECT 1 FROM "contract_party"
           WHERE "contract_id" = main_contract_id
             AND "company_id" = NEW."company_id"
             AND "party_type" = 'awarding'
        ) THEN
          RAISE EXCEPTION 'The main contract''s awarding party cannot be a party to its subcontract.'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "${RULES_TRIGGER}"
        BEFORE INSERT OR UPDATE OF "contract_id", "company_id", "party_type"
        ON "contract_party"
        FOR EACH ROW EXECUTE FUNCTION "${RULES_FUNCTION}"()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "${RULES_TRIGGER}" ON "contract_party"`,
    );
    await queryRunner.query(`DROP FUNCTION "${RULES_FUNCTION}"()`);
    await queryRunner.query(`DROP INDEX "${ONE_AWARDED_INDEX}"`);
    await queryRunner.query(`
      ALTER TABLE "contract_party" DROP CONSTRAINT "${ONE_PARTY_PER_COMPANY}"
    `);
  }
}
