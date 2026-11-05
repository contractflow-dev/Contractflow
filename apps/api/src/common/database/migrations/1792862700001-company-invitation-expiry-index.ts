import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyInvitationExpiryIndex1792862700001 implements MigrationInterface {
  name = 'CompanyInvitationExpiryIndex1792862700001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [existingIndex] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_index ix
        JOIN pg_class index_table ON index_table.oid = ix.indexrelid
        JOIN pg_class table_row ON table_row.oid = ix.indrelid
        JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        JOIN pg_am access_method ON access_method.oid = index_table.relam
        WHERE namespace_row.nspname = current_schema()
          AND table_row.relname = 'company_invitation'
          AND index_table.relname = 'ix_company_invitation_company_status_expiry'
          AND access_method.amname = 'btree'
          AND NOT ix.indisunique
          AND ix.indisvalid
          AND ix.indisready
          AND ix.indislive
          AND ix.indpred IS NULL
          AND ix.indexprs IS NULL
          AND ix.indnkeyatts = 3
          AND ix.indnatts = 3
          AND (
            SELECT array_agg(attribute_row.attname ORDER BY key_row.ordinality)
            FROM unnest(ix.indkey) WITH ORDINALITY AS key_row(attnum, ordinality)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = table_row.oid
             AND attribute_row.attnum = key_row.attnum
          ) = ARRAY['company_id', 'status', 'expires_at']::name[]
      ) AS present
    `);
    if (existingIndex.present) return;

    const [nameOccupied] = await queryRunner.query(`
      SELECT to_regclass(format('%I.%I', current_schema(),
        'ix_company_invitation_company_status_expiry')) IS NOT NULL AS present
    `);
    if (nameOccupied.present) {
      throw new Error(
        'The company invitation expiry index name is occupied by an incompatible object.',
      );
    }

    await queryRunner.query(`
      CREATE INDEX "ix_company_invitation_company_status_expiry"
      ON "company_invitation" ("company_id", "status", "expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [existingIndex] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_index ix
        JOIN pg_class index_table ON index_table.oid = ix.indexrelid
        JOIN pg_class table_row ON table_row.oid = ix.indrelid
        JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        JOIN pg_am access_method ON access_method.oid = index_table.relam
        WHERE namespace_row.nspname = current_schema()
          AND table_row.relname = 'company_invitation'
          AND index_table.relname = 'ix_company_invitation_company_status_expiry'
          AND access_method.amname = 'btree'
          AND NOT ix.indisunique
          AND ix.indisvalid
          AND ix.indisready
          AND ix.indislive
          AND ix.indpred IS NULL
          AND ix.indexprs IS NULL
          AND ix.indnkeyatts = 3
          AND ix.indnatts = 3
          AND (
            SELECT array_agg(attribute_row.attname ORDER BY key_row.ordinality)
            FROM unnest(ix.indkey) WITH ORDINALITY AS key_row(attnum, ordinality)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = table_row.oid
             AND attribute_row.attnum = key_row.attnum
          ) = ARRAY['company_id', 'status', 'expires_at']::name[]
      ) AS present
    `);
    if (!existingIndex.present) {
      throw new Error(
        'Refusing to drop a missing or incompatible company invitation expiry index.',
      );
    }
    await queryRunner.query(
      'DROP INDEX "ix_company_invitation_company_status_expiry"',
    );
  }
}
