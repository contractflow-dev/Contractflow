import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractRoleRevocationNullable1791882600001 implements MigrationInterface {
  name = 'ContractRoleRevocationNullable1791882600001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [activeDuplicates] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM (
        SELECT "contract_party_id", "company_user_id", "contract_role"
        FROM "contract_role_assignment"
        WHERE "revoked_at" IS NULL
        GROUP BY "contract_party_id", "company_user_id", "contract_role"
        HAVING COUNT(*) > 1
      ) AS duplicate_assignments
    `);
    if (Number(activeDuplicates.count) > 0) {
      throw new Error(
        'Cannot enforce unique active contract roles while duplicate assignments exist.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ALTER COLUMN "revoked_at" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ALTER COLUMN "revoked_by_id" DROP NOT NULL',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_role_assignment_active"
      ON "contract_role_assignment" (
        "contract_party_id",
        "company_user_id",
        "contract_role"
      )
      WHERE "revoked_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"uq_contract_role_assignment_active"')
            AND ix.indrelid = '"contract_role_assignment"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE UNIQUE INDEX uq_contract_role_assignment_active ON contract_role_assignment USING btree (contract_party_id, company_user_id, contract_role) WHERE revoked_at IS NULL'
        ) THEN
          RAISE EXCEPTION 'Existing index "uq_contract_role_assignment_active" on "contract_role_assignment" does not match the migration definition.';
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [activeAssignments] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "contract_role_assignment"
      WHERE "revoked_at" IS NULL OR "revoked_by_id" IS NULL
    `);
    if (Number(activeAssignments.count) > 0) {
      throw new Error(
        'Cannot restore required revocation fields while active contract role assignments exist.',
      );
    }

    await queryRunner.query('DROP INDEX "uq_contract_role_assignment_active"');
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ALTER COLUMN "revoked_by_id" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "contract_role_assignment" ALTER COLUMN "revoked_at" SET NOT NULL',
    );
  }
}
