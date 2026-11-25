import type { MigrationInterface, QueryRunner } from 'typeorm';

const BACKUP_TABLE = 'migration_contract_actual_completion_backup';

/**
 * Removes `contract.actual_completion_date`. It was a date typed in when a
 * contract was created or edited, never set by the application, and nothing
 * calculated from it. When a contract was completed is recorded by its
 * status history (the `completed` entry's `changed_at`) and its activity log.
 *
 * Nothing is lost: every stored value is copied to a backup table first, so
 * `down` puts back exactly what was there. Stage and milestone actual dates
 * are a different record and are kept.
 */
export class RemoveActualCompletionDate1794000000004 implements MigrationInterface {
  name = 'RemoveActualCompletionDate1794000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${BACKUP_TABLE}" (
        "contract_id" character varying(26) NOT NULL,
        "actual_completion_date" date NOT NULL,
        CONSTRAINT "pk_${BACKUP_TABLE}" PRIMARY KEY ("contract_id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "${BACKUP_TABLE}" ("contract_id", "actual_completion_date")
      SELECT "id", "actual_completion_date" FROM "contract"
       WHERE "actual_completion_date" IS NOT NULL
      ON CONFLICT ("contract_id")
        DO UPDATE SET "actual_completion_date" = EXCLUDED."actual_completion_date"
    `);
    await queryRunner.query(
      `ALTER TABLE "contract" DROP COLUMN "actual_completion_date"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract" ADD COLUMN "actual_completion_date" date`,
    );
    await queryRunner.query(`
      UPDATE "contract" c SET "actual_completion_date" = b."actual_completion_date"
        FROM "${BACKUP_TABLE}" b
       WHERE b."contract_id" = c."id"
    `);
    await queryRunner.query(`DROP TABLE "${BACKUP_TABLE}"`);
  }
}
