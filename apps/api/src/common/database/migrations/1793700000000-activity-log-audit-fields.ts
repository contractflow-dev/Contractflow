import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes `activity_log` able to say which record an entry concerns, which
 * workspace it belongs to, and why the action was taken.
 *
 * - `entity_id` was a `uuid` column, but every record id is a 26-character
 *   ULID, so writers stored a random UUID there and kept the real id in the
 *   JSON. It becomes `varchar(36)`: existing UUID values are kept as text, and
 *   new entries store the affected record's own id.
 * - `workspace` (nullable) names the contract workspace whose content
 *   changed; contract-wide entries leave it null. The feed hides an entry from
 *   readers with no role in its workspace.
 * - `reason` (nullable) keeps the explanation given for a decision, such as a
 *   rejection, outside the change set.
 * - Indexes cover the feed (company, contract, newest first) and the lookup of
 *   one record's history. The table had none.
 *
 * No existing row changes meaning; nothing is deleted. `down` restores the
 * `uuid` column, replacing the ULIDs written since with fresh UUIDs, which is
 * what writers stored before. Entries keep their record ids in `changes` or
 * `metadata` as before, so the feed's links still work after a rollback.
 */
export class ActivityLogAuditFields1793700000000 implements MigrationInterface {
  name = 'ActivityLogAuditFields1793700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_log"
        ALTER COLUMN "entity_id" TYPE character varying(36)
        USING "entity_id"::text
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_log"
        ADD COLUMN IF NOT EXISTS "workspace" character varying(20),
        ADD COLUMN IF NOT EXISTS "reason" character varying(2000)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ck_activity_log_workspace'
            AND conrelid = '"activity_log"'::regclass
        ) THEN
          ALTER TABLE "activity_log"
            ADD CONSTRAINT "ck_activity_log_workspace"
            CHECK ("workspace" IS NULL OR "workspace" IN ('project', 'hse', 'finance'));
        END IF;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_activity_log_feed"
        ON "activity_log" ("company_id", "contract_id", "occurred_at" DESC, "id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_activity_log_entity"
        ON "activity_log" ("company_id", "contract_id", "entity_type", "entity_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."ix_activity_log_entity"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."ix_activity_log_feed"',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "ck_activity_log_workspace"',
    );
    await queryRunner.query(`
      ALTER TABLE "activity_log"
        DROP COLUMN IF EXISTS "reason",
        DROP COLUMN IF EXISTS "workspace"
    `);
    await queryRunner.query(`
      UPDATE "activity_log"
        SET "entity_id" = gen_random_uuid()::text
        WHERE "entity_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_log"
        ALTER COLUMN "entity_id" TYPE uuid
        USING "entity_id"::uuid
    `);
  }
}
