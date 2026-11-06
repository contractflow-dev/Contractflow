import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyEmailVerification1793200000000 implements MigrationInterface {
  name = 'CompanyEmailVerification1793200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_verification_token" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "company_id" character varying(26) NOT NULL,
        "email" citext NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_company_verification_token" PRIMARY KEY ("id"),
        CONSTRAINT "uq_company_verification_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_company_verification_token_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_company_verification_company_created"
      ON "company_verification_token" ("company_id", "created_at")
    `);

    // Contract invitations find the target company by email, so at most one
    // verified company may hold each address. The column is citext, so this
    // is case-insensitive.
    const [duplicates] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM (
        SELECT "email" FROM "company"
        WHERE "verified_at" IS NOT NULL
        GROUP BY "email" HAVING COUNT(*) > 1
      ) AS duplicate_emails
    `);
    if (duplicates.count > 0) {
      throw new Error(
        'Cannot add the verified company email index: several verified companies share an email. Clear verified_at on all but one of each before migrating.',
      );
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_company_verified_email"
      ON "company" ("email") WHERE "verified_at" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "ux_company_verified_email"');
    await queryRunner.query('DROP TABLE IF EXISTS "company_verification_token"');
  }
}
