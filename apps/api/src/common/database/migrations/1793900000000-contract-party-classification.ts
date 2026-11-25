import type { MigrationInterface, QueryRunner } from 'typeorm';

const PARTY_TYPE = 'contract_party_party_type_enum';
const BACKUP_TABLE = 'migration_contract_party_type_backup';
const OLD_PARTY_LABELS = [
  'client',
  'contractor',
  'subcontractor',
  'vendor',
  'other',
];
const NEW_PARTY_LABELS = ['awarding', 'awarded'];
const ONE_AWARDING_INDEX = 'uq_contract_party_one_awarding';
const INVITATION_CHECK = 'ck_contract_party_invitation_type';

function enumList(labels: string[]): string {
  return labels.map((label) => `'${label}'`).join(', ');
}

/**
 * A contract party is classified only as AWARDING (the party that awarded the
 * contract) or AWARDED (the party it was awarded to). The old values mixed
 * that classification with a business identity (client, contractor,
 * subcontractor, vendor, other).
 *
 * Mapping, decided per row:
 * - `client` becomes `awarding`.
 * - On a subcontract (a contract with a parent), the party of the company
 *   that created it becomes `awarding`: the main contractor awards the work.
 * - Every other party becomes `awarded`.
 * Pending and past party invitations all invited an awarded party
 * (contractor or subcontractor), so they become `awarded`.
 *
 * A contract may have at most one AWARDING party. The migration refuses
 * rather than guess when the mapping would give a contract two, or would
 * merge two pending invitations to the same company.
 *
 * The enum type keeps its name, which the migration recovery planner checks.
 * The old values are copied to a backup table first, so `down` can put back
 * exactly what was there. `down` refuses when a row has no old value.
 */
export class ContractPartyClassification1793900000000 implements MigrationInterface {
  name = 'ContractPartyClassification1793900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [conflicts] = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::int FROM (
          SELECT p."contract_id"
            FROM "contract_party" p
            JOIN "contract" c ON c."id" = p."contract_id"
           WHERE p."party_type"::text = 'client'
              OR (c."parent_contract_id" IS NOT NULL
                  AND c."created_by_company_id" = p."company_id")
           GROUP BY p."contract_id"
          HAVING COUNT(*) > 1
        ) AS many) AS contracts,
        (SELECT COUNT(*)::int FROM (
          SELECT 1
            FROM "contract_party_invitation"
           WHERE "status" = 'pending'
           GROUP BY "source_contract_party_id", "target_company_id"
          HAVING COUNT(*) > 1
        ) AS pending) AS invitations
    `)) as Array<{ contracts: number; invitations: number }>;
    const contracts = Number(conflicts.contracts);
    const invitations = Number(conflicts.invitations);
    if (contracts > 0 || invitations > 0) {
      throw new Error(
        `Cannot classify contract parties as awarding or awarded: ` +
          `${contracts} contract(s) would have more than one awarding party ` +
          `and ${invitations} company pair(s) have more than one pending ` +
          'invitation. Resolve them deliberately before migrating.',
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${BACKUP_TABLE}" (
        "table_name" character varying(32) NOT NULL,
        "row_id" character varying(26) NOT NULL,
        "party_type" text NOT NULL,
        CONSTRAINT "pk_${BACKUP_TABLE}" PRIMARY KEY ("table_name", "row_id")
      )
    `);
    for (const table of ['contract_party', 'contract_party_invitation']) {
      await queryRunner.query(`
        INSERT INTO "${BACKUP_TABLE}" ("table_name", "row_id", "party_type")
        SELECT '${table}', "id", "party_type"::text FROM "${table}"
        ON CONFLICT ("table_name", "row_id")
          DO UPDATE SET "party_type" = EXCLUDED."party_type"
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "contract_party" ALTER COLUMN "party_type" TYPE text
        USING "party_type"::text
    `);
    await queryRunner.query(`
      UPDATE "contract_party" p
         SET "party_type" = CASE
           WHEN p."party_type" = 'client'
             OR (c."parent_contract_id" IS NOT NULL
                 AND c."created_by_company_id" = p."company_id")
           THEN 'awarding'
           ELSE 'awarded'
         END
        FROM "contract" c
       WHERE c."id" = p."contract_id"
    `);
    await this.recreatePartyType(queryRunner, NEW_PARTY_LABELS);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "${ONE_AWARDING_INDEX}"
        ON "contract_party" ("contract_id")
        WHERE "party_type" = 'awarding'
    `);

    await queryRunner.query(`
      ALTER TABLE "contract_party_invitation"
        DROP CONSTRAINT "${INVITATION_CHECK}"
    `);
    await queryRunner.query(`
      UPDATE "contract_party_invitation" SET "party_type" = 'awarded'
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_party_invitation"
        ADD CONSTRAINT "${INVITATION_CHECK}"
        CHECK ("party_type" IN ('awarded'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A party or invitation created after this migration has no old value,
    // and its business identity can't be inferred from awarding/awarded.
    const [blocked] = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "contract_party" p
          WHERE NOT EXISTS (
            SELECT 1 FROM "${BACKUP_TABLE}" b
             WHERE b."table_name" = 'contract_party' AND b."row_id" = p."id")
        ) AS parties,
        (SELECT COUNT(*)::int FROM "contract_party_invitation" i
          WHERE NOT EXISTS (
            SELECT 1 FROM "${BACKUP_TABLE}" b
             WHERE b."table_name" = 'contract_party_invitation'
               AND b."row_id" = i."id")
        ) AS invitations
    `)) as Array<{ parties: number; invitations: number }>;
    const parties = Number(blocked.parties);
    const invitations = Number(blocked.invitations);
    if (parties > 0 || invitations > 0) {
      throw new Error(
        `Cannot restore the old party types: ${parties} party row(s) and ` +
          `${invitations} invitation(s) have no earlier party type to ` +
          'return to. Give them one deliberately before rolling back.',
      );
    }

    await queryRunner.query(`DROP INDEX "${ONE_AWARDING_INDEX}"`);
    await queryRunner.query(`
      ALTER TABLE "contract_party" ALTER COLUMN "party_type" TYPE text
        USING "party_type"::text
    `);
    await queryRunner.query(`
      UPDATE "contract_party" p SET "party_type" = b."party_type"
        FROM "${BACKUP_TABLE}" b
       WHERE b."table_name" = 'contract_party' AND b."row_id" = p."id"
    `);
    await this.recreatePartyType(queryRunner, OLD_PARTY_LABELS);

    await queryRunner.query(`
      ALTER TABLE "contract_party_invitation"
        DROP CONSTRAINT "${INVITATION_CHECK}"
    `);
    await queryRunner.query(`
      UPDATE "contract_party_invitation" i SET "party_type" = b."party_type"
        FROM "${BACKUP_TABLE}" b
       WHERE b."table_name" = 'contract_party_invitation'
         AND b."row_id" = i."id"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_party_invitation"
        ADD CONSTRAINT "${INVITATION_CHECK}"
        CHECK ("party_type" IN ('contractor', 'subcontractor'))
    `);
    await queryRunner.query(`DROP TABLE "${BACKUP_TABLE}"`);
  }

  /** Drops the enum and recreates it with `labels` for the text column. */
  private async recreatePartyType(
    queryRunner: QueryRunner,
    labels: string[],
  ): Promise<void> {
    await queryRunner.query(`DROP TYPE "public"."${PARTY_TYPE}"`);
    await queryRunner.query(
      `CREATE TYPE "public"."${PARTY_TYPE}" AS ENUM(${enumList(labels)})`,
    );
    await queryRunner.query(`
      ALTER TABLE "contract_party" ALTER COLUMN "party_type"
        TYPE "public"."${PARTY_TYPE}"
        USING "party_type"::"public"."${PARTY_TYPE}"
    `);
  }
}
