import type { MigrationInterface, QueryRunner } from 'typeorm';

const COLUMNS = [
  ['from_status', 'contract_status_history_from_status_enum'],
  ['to_status', 'contract_status_history_to_status_enum'],
] as const;

const OLD_LABELS = [
  'draft',
  'active',
  'suspended',
  'completed',
  'cancelled',
  'under_review',
];
/** The contract statuses (`contract_status_enum`), in the same order. */
const NEW_LABELS = ['draft', 'active', 'suspended', 'completed'];

function enumList(labels: readonly string[]): string {
  return labels.map((label) => `'${label}'`).join(', ');
}

/**
 * A contract's status is exactly draft, active, suspended or completed;
 * archiving is `contract.deleted_at`, never a status. Status history still
 * allowed `cancelled` and `under_review`, which no contract can have. They
 * are removed so history can only record real contract statuses.
 *
 * History is never rewritten: the migration refuses, and reports how many
 * rows, if any history entry uses either value. The enum types keep their
 * names, which the migration recovery planner checks.
 */
export class ContractStatusHistoryValues1794000000001 implements MigrationInterface {
  name = 'ContractStatusHistoryValues1794000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [{ rows }] = (await queryRunner.query(`
      SELECT COUNT(*)::int AS rows FROM "contract_status_history"
       WHERE "from_status"::text IN ('cancelled', 'under_review')
          OR "to_status"::text IN ('cancelled', 'under_review')
    `)) as Array<{ rows: number }>;
    if (Number(rows) > 0) {
      throw new Error(
        `Cannot remove the cancelled and under_review statuses: ${rows} ` +
          'contract status history row(s) use them. History is not ' +
          'rewritten; resolve them deliberately before migrating.',
      );
    }
    await this.replaceTypes(queryRunner, NEW_LABELS);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Every current value is in the old set, so nothing is refused.
    await this.replaceTypes(queryRunner, OLD_LABELS);
  }

  /** Recreates both enums with `labels`, holding the values as text meanwhile. */
  private async replaceTypes(
    queryRunner: QueryRunner,
    labels: readonly string[],
  ): Promise<void> {
    for (const [column, typeName] of COLUMNS) {
      await queryRunner.query(`
        ALTER TABLE "contract_status_history"
          ALTER COLUMN "${column}" TYPE text USING "${column}"::text
      `);
      await queryRunner.query(`DROP TYPE "public"."${typeName}"`);
      await queryRunner.query(
        `CREATE TYPE "public"."${typeName}" AS ENUM(${enumList(labels)})`,
      );
      await queryRunner.query(`
        ALTER TABLE "contract_status_history"
          ALTER COLUMN "${column}" TYPE "public"."${typeName}"
          USING "${column}"::"public"."${typeName}"
      `);
    }
  }
}
