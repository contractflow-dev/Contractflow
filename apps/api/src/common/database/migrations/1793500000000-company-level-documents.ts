import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Company-wide documents: a document with no contract belongs only to its
 * owner company (ERD: "contract_id nullable, null = company-level file").
 * They are never shared, so the database refuses a shared one.
 */
export class CompanyLevelDocuments1793500000000 implements MigrationInterface {
  name = 'CompanyLevelDocuments1793500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "document" ALTER COLUMN "contract_id" DROP NOT NULL
    `);
    // Shared ("public") visibility only makes sense among contract parties.
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "document"
          ADD CONSTRAINT "ck_document_company_level_private"
          CHECK ("contract_id" IS NOT NULL OR "visibility" = 'private');
      EXCEPTION
        WHEN duplicate_object THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"document"'::regclass
              AND conname = 'ck_document_company_level_private'
              AND convalidated
              AND pg_get_constraintdef(oid, true) = 'CHECK (contract_id IS NOT NULL OR visibility = ''private''::document_visibility_enum)'
          ) THEN
            RAISE EXCEPTION 'Existing constraint "ck_document_company_level_private" on "document" does not match the migration definition.';
          END IF;
      END $$;
    `);
    // The company library lists a company's active company-wide documents,
    // newest first.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_company_level_active"
        ON "document" ("owner_company_id", "created_at")
        WHERE "contract_id" IS NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"IDX_document_company_level_active"')
            AND ix.indrelid = '"document"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE INDEX "IDX_document_company_level_active" ON document USING btree (owner_company_id, created_at) WHERE contract_id IS NULL AND deleted_at IS NULL'
        ) THEN
          RAISE EXCEPTION 'Existing index "IDX_document_company_level_active" on "document" does not match the migration definition.';
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Restoring NOT NULL would need these rows removed; never do that
    // silently. Move or remove company-wide documents deliberately first.
    const [{ count }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM "document" WHERE "contract_id" IS NULL
    `);
    if (Number(count) > 0) {
      throw new Error(
        'Cannot remove company-wide documents while any exist (including deleted ones kept for audit).',
      );
    }
    await queryRunner.query(
      'DROP INDEX "public"."IDX_document_company_level_active"',
    );
    await queryRunner.query(
      'ALTER TABLE "document" DROP CONSTRAINT "ck_document_company_level_private"',
    );
    await queryRunner.query(`
      ALTER TABLE "document" ALTER COLUMN "contract_id" SET NOT NULL
    `);
  }
}
