import type { MigrationInterface, QueryRunner } from 'typeorm';

type ExpectedColumn = [
  name: string,
  type: string,
  notNull: boolean,
  defaultExpression: string | null,
];

/**
 * Columns this migration adds may already exist (for example when the schema
 * was created outside migration history). An existing column is accepted
 * only when it already matches the definition the migration leaves behind.
 */
async function assertExistingColumnsMatch(
  queryRunner: QueryRunner,
  table: string,
  expected: ExpectedColumn[],
): Promise<void> {
  const existing = (await queryRunner.query(
    `
      SELECT a.attname AS "name",
        format_type(a.atttypid, a.atttypmod) AS "type",
        a.attnotnull AS "notNull",
        pg_get_expr(d.adbin, d.adrelid) AS "defaultExpression"
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = ANY($2)
    `,
    [`"${table}"`, expected.map(([name]) => name)],
  )) as Array<{
    name: string;
    type: string;
    notNull: boolean;
    defaultExpression: string | null;
  }>;
  for (const column of existing) {
    const match = expected.find(([name]) => name === column.name);
    if (!match) continue;
    const [, type, notNull, defaultExpression] = match;
    if (
      column.type !== type ||
      column.notNull !== notNull ||
      column.defaultExpression !== defaultExpression
    ) {
      throw new Error(
        `Existing column "${table}"."${column.name}" does not match the migration schema.`,
      );
    }
  }
}

/**
 * Object storage metadata and upload lifecycle for document versions, and
 * soft deletion for documents.
 */
export class DocumentObjectStorage1793300000000 implements MigrationInterface {
  name = 'DocumentObjectStorage1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."document_version_upload_status_enum"
          AS ENUM('pending_upload', 'processing', 'available', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN
          IF ARRAY(
            SELECT enumlabel::text FROM pg_enum
            WHERE enumtypid = '"public"."document_version_upload_status_enum"'::regtype
            ORDER BY enumsortorder
          ) IS DISTINCT FROM ARRAY['pending_upload', 'processing', 'available', 'failed']::text[] THEN
            RAISE EXCEPTION 'Existing type "public"."document_version_upload_status_enum" does not match the migration definition.';
          END IF;
      END $$;
    `);

    // Columns that already exist must already have this migration's final
    // definition; only missing columns are added.
    await assertExistingColumnsMatch(queryRunner, 'document_version', [
      [
        'upload_status',
        'document_version_upload_status_enum',
        true,
        "'pending_upload'::document_version_upload_status_enum",
      ],
      ['storage_provider', 'character varying(32)', true, null],
      ['storage_bucket', 'character varying(255)', true, null],
      ['storage_version_id', 'character varying(1024)', false, null],
      ['upload_expires_at', 'timestamp with time zone', false, null],
      ['failure_reason', 'character varying(255)', false, null],
    ]);
    await assertExistingColumnsMatch(queryRunner, 'document', [
      ['deleted_at', 'timestamp with time zone', false, null],
      ['deleted_by_id', 'character varying(26)', false, null],
    ]);

    // Rows that predate the lifecycle were recorded as uploaded; they keep
    // that meaning and are marked with a "legacy" provider.
    await queryRunner.query(`
      ALTER TABLE "document_version"
        ADD COLUMN IF NOT EXISTS "upload_status" "public"."document_version_upload_status_enum" NOT NULL DEFAULT 'available',
        ADD COLUMN IF NOT EXISTS "storage_provider" character varying(32) NOT NULL DEFAULT 'legacy',
        ADD COLUMN IF NOT EXISTS "storage_bucket" character varying(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "storage_version_id" character varying(1024),
        ADD COLUMN IF NOT EXISTS "upload_expires_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "failure_reason" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "document_version"
        ALTER COLUMN "upload_status" SET DEFAULT 'pending_upload',
        ALTER COLUMN "storage_provider" DROP DEFAULT,
        ALTER COLUMN "storage_bucket" DROP DEFAULT
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_document_version_document_version_number"
        ON "document_version" ("document_id", "version_number")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"UQ_document_version_document_version_number"')
            AND ix.indrelid = '"document_version"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE UNIQUE INDEX "UQ_document_version_document_version_number" ON document_version USING btree (document_id, version_number)'
        ) THEN
          RAISE EXCEPTION 'Existing index "UQ_document_version_document_version_number" on "document_version" does not match the migration definition.';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_document_version_storage_key"
        ON "document_version" ("storage_key")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"UQ_document_version_storage_key"')
            AND ix.indrelid = '"document_version"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE UNIQUE INDEX "UQ_document_version_storage_key" ON document_version USING btree (storage_key)'
        ) THEN
          RAISE EXCEPTION 'Existing index "UQ_document_version_storage_key" on "document_version" does not match the migration definition.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "document"
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "deleted_by_id" character varying(26)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "document"
          ADD CONSTRAINT "FK_document_deleted_by_company_user"
          FOREIGN KEY ("deleted_by_id") REFERENCES "company_user"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"document"'::regclass
              AND conname = 'FK_document_deleted_by_company_user'
              AND convalidated
              AND pg_get_constraintdef(oid, true) = 'FOREIGN KEY (deleted_by_id) REFERENCES company_user(id)'
          ) THEN
            RAISE EXCEPTION 'Existing constraint "FK_document_deleted_by_company_user" on "document" does not match the migration definition.';
          END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_contract_owner_active"
        ON "document" ("contract_id", "owner_company_id", "created_at")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"IDX_document_contract_owner_active"')
            AND ix.indrelid = '"document"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE INDEX "IDX_document_contract_owner_active" ON document USING btree (contract_id, owner_company_id, created_at) WHERE deleted_at IS NULL'
        ) THEN
          RAISE EXCEPTION 'Existing index "IDX_document_contract_owner_active" on "document" does not match the migration definition.';
        END IF;
      END $$;
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
