import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables whose generic `entity_id` reference was created as `uuid`. */
const TABLES = ['comment', 'notification', 'document_link'] as const;

/** The ULID shape, as `ULID_PATTERN` in @contractflow/contracts-schema. */
const ULID_CHECK = `"entity_id" ~* '^[0-7][0-9A-HJKMNP-TV-Z]{25}$'`;

function checkName(table: string): string {
  return `ck_${table}_entity_id_ulid`;
}

/**
 * Every ContractFlow record id is a ULID (`varchar(26)`), but `comment`,
 * `notification` and `document_link` were created with `entity_id uuid`: a
 * column that can't hold the id of the record it refers to. They become
 * `varchar(26)` with a CHECK that the value is a ULID.
 *
 * These references are polymorphic (`entity_type` names the table), so no
 * foreign key can protect them. No application code writes these tables
 * yet; whatever writes them must check, in the same transaction, that the
 * referenced record exists in the same contract or company scope.
 *
 * Any existing row holds a UUID, which can't refer to a ULID record and has
 * no ULID to become. Rather than discard or invent values, the migration
 * refuses while such rows exist, and reports how many.
 *
 * `activity_log.entity_id` is deliberately left as `varchar(36)`: it is
 * append-only audit history, and entries written before ULIDs may hold a
 * UUID (ActivityLogAuditFields1793700000000).
 */
export class UlidEntityReferences1794000000000 implements MigrationInterface {
  name = 'UlidEntityReferences1794000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const counts: string[] = [];
    for (const table of TABLES) {
      const [{ rows }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS rows FROM "${table}"`,
      )) as Array<{ rows: number }>;
      if (Number(rows) > 0) counts.push(`${table}: ${rows}`);
    }
    if (counts.length > 0) {
      throw new Error(
        `Cannot convert entity_id to a ULID: existing rows hold UUIDs that ` +
          `refer to no ULID record (${counts.join(', ')}). Review and ` +
          'resolve them deliberately before migrating.',
      );
    }

    for (const table of TABLES) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "entity_id" TYPE character varying(26)
          USING "entity_id"::text
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD CONSTRAINT "${checkName(table)}" CHECK (${ULID_CHECK})
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A ULID can't become a UUID, so rows written since can't go back.
    const counts: string[] = [];
    for (const table of TABLES) {
      const [{ rows }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS rows FROM "${table}"`,
      )) as Array<{ rows: number }>;
      if (Number(rows) > 0) counts.push(`${table}: ${rows}`);
    }
    if (counts.length > 0) {
      throw new Error(
        `Cannot restore uuid entity_id columns: rows hold ULIDs ` +
          `(${counts.join(', ')}). Remove them deliberately before rolling back.`,
      );
    }

    for (const table of TABLES) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT "${checkName(table)}"
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "entity_id" TYPE uuid USING "entity_id"::uuid
      `);
    }
  }
}
