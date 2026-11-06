import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Object storage metadata and upload lifecycle for document versions, and
 * soft deletion for documents.
 */
export class DocumentObjectStorage1793300000000 implements MigrationInterface {
  name = 'DocumentObjectStorage1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."document_version_upload_status_enum"
        AS ENUM('pending_upload', 'processing', 'available', 'failed')
    `);

    // Rows that predate the lifecycle were recorded as uploaded; they keep
    // that meaning and are marked with a "legacy" provider.
    await queryRunner.query(`
      ALTER TABLE "document_version"
        ADD COLUMN "upload_status" "public"."document_version_upload_status_enum" NOT NULL DEFAULT 'available',
        ADD COLUMN "storage_provider" character varying(32) NOT NULL DEFAULT 'legacy',
        ADD COLUMN "storage_bucket" character varying(255) NOT NULL DEFAULT '',
        ADD COLUMN "storage_version_id" character varying(1024),
        ADD COLUMN "upload_expires_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "failure_reason" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "document_version"
        ALTER COLUMN "upload_status" SET DEFAULT 'pending_upload',
        ALTER COLUMN "storage_provider" DROP DEFAULT,
        ALTER COLUMN "storage_bucket" DROP DEFAULT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_document_version_document_version_number"
        ON "document_version" ("document_id", "version_number")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_document_version_storage_key"
        ON "document_version" ("storage_key")
    `);

    await queryRunner.query(`
      ALTER TABLE "document"
        ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "deleted_by_id" character varying(26)
    `);
    await queryRunner.query(`
      ALTER TABLE "document"
        ADD CONSTRAINT "FK_document_deleted_by_company_user"
        FOREIGN KEY ("deleted_by_id") REFERENCES "company_user"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_contract_owner_active"
        ON "document" ("contract_id", "owner_company_id", "created_at")
        WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM "document_version"
      WHERE "upload_status" <> 'available'
    `);
    if (Number(count) > 0) {
      throw new Error(
        'Cannot remove the document upload lifecycle while unfinished or failed uploads exist.',
      );
    }
    const [{ deleted }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS deleted
      FROM "document"
      WHERE "deleted_at" IS NOT NULL
    `);
    if (Number(deleted) > 0) {
      throw new Error(
        'Cannot remove document soft deletion while deleted documents exist.',
      );
    }

    await queryRunner.query(
      'DROP INDEX "public"."IDX_document_contract_owner_active"',
    );
    await queryRunner.query(
      'ALTER TABLE "document" DROP CONSTRAINT "FK_document_deleted_by_company_user"',
    );
    await queryRunner.query(`
      ALTER TABLE "document"
        DROP COLUMN "deleted_by_id",
        DROP COLUMN "deleted_at"
    `);

    await queryRunner.query(
      'DROP INDEX "public"."UQ_document_version_storage_key"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."UQ_document_version_document_version_number"',
    );
    await queryRunner.query(`
      ALTER TABLE "document_version"
        DROP COLUMN "failure_reason",
        DROP COLUMN "upload_expires_at",
        DROP COLUMN "storage_version_id",
        DROP COLUMN "storage_bucket",
        DROP COLUMN "storage_provider",
        DROP COLUMN "upload_status"
    `);
    await queryRunner.query(
      'DROP TYPE "public"."document_version_upload_status_enum"',
    );
  }
}
