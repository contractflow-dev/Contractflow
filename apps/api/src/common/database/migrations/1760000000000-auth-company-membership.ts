import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthCompanyMembership1760000000000
  implements MigrationInterface
{
  name = 'AuthCompanyMembership1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "app_user" ALTER COLUMN "email_verified_at" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "app_user" ALTER COLUMN "last_login_at" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "ip_address" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "revoked_at" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "user_agent" SET DEFAULT \'\'',
    );
    await queryRunner.query(
      'ALTER TABLE "company_user" ALTER COLUMN "left_at" DROP NOT NULL',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_token" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" character varying(26) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "uq_email_verification_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "pk_email_verification_token" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_email_verification_user_created"
      ON "email_verification_token" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_company_user_company_user"
      ON "company_user" ("company_id", "user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const nullableColumns = [
      ['app_user', 'email_verified_at'],
      ['app_user', 'last_login_at'],
      ['user_session', 'ip_address'],
      ['user_session', 'revoked_at'],
      ['company_user', 'left_at'],
    ] as const;

    for (const [table, column] of nullableColumns) {
      const [{ hasNulls }] = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM "${table}" WHERE "${column}" IS NULL) AS "hasNulls"`,
      );
      if (hasNulls) {
        throw new Error(
          `Cannot roll back auth schema while ${table}.${column} contains NULL values.`,
        );
      }
    }

    await queryRunner.query(
      'DROP INDEX IF EXISTS "uq_company_user_company_user"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "ix_email_verification_user_created"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "email_verification_token"');
    await queryRunner.query(
      'ALTER TABLE "company_user" ALTER COLUMN "left_at" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "user_agent" DROP DEFAULT',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "revoked_at" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "user_session" ALTER COLUMN "ip_address" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "app_user" ALTER COLUMN "last_login_at" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "app_user" ALTER COLUMN "email_verified_at" SET NOT NULL',
    );
  }
}
