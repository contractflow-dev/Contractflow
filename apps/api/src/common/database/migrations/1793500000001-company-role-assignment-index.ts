import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The company-wide list of contract roles reads a company's active
 * assignments, oldest first. Existing indexes are keyed by contract party,
 * not by company. Adding or dropping the index changes no data.
 */
export class CompanyRoleAssignmentIndex1793500000001 implements MigrationInterface {
  name = 'CompanyRoleAssignmentIndex1793500000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_contract_role_assignment_company_active"
        ON "contract_role_assignment" ("company_id", "assigned_at")
        WHERE "revoked_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "public"."ix_contract_role_assignment_company_active"',
    );
  }
}
