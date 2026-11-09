import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetToken1793400000000 implements MigrationInterface {
  name = 'PasswordResetToken1793400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Only a SHA-256 hash of each reset token is stored, never the token.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_token" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" character varying(26) NOT NULL,
        "token_hash" character(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_password_reset_token" PRIMARY KEY ("id"),
        CONSTRAINT "uq_password_reset_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_password_reset_token_user"
          FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE
      )
    `);
    // Rate limits read a user's recent tokens; replacing them reads the
    // unused ones. Both filter on user_id.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_password_reset_user_created"
      ON "password_reset_token" ("user_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "password_reset_token"');
  }
}
