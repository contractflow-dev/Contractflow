import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyInvitationLifecycle1792400000000 implements MigrationInterface {
  name = 'CompanyInvitationLifecycle1792400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "company_invitation_status_enum"
      ADD VALUE IF NOT EXISTS 'expired'
    `);
    await queryRunner.query(`
      ALTER TYPE "company_invitation_status_enum"
      ADD VALUE IF NOT EXISTS 'revoked'
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "accepted_at" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ADD COLUMN "revoked_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_company_invitation_company_status_expiry"
      ON "company_invitation" ("company_id", "status", "expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const pendingInvitations = (await queryRunner.query(`
      SELECT COUNT(*)::text AS "count"
      FROM "company_invitation"
      WHERE "accepted_at" IS NULL
    `)) as Array<{ count: string }>;
    if (Number(pendingInvitations[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot revert the invitation lifecycle migration while invitations with a null accepted_at exist.',
      );
    }
    await queryRunner.query(`
      DROP INDEX IF EXISTS "ix_company_invitation_company_status_expiry"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "accepted_at" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      DROP COLUMN "revoked_at"
    `);
    await queryRunner.query(`
      UPDATE "company_invitation"
      SET "status" = 'declined'
      WHERE "status" IN ('expired', 'revoked')
    `);
    await queryRunner.query(`
      CREATE TYPE "company_invitation_status_enum_old"
      AS ENUM ('pending', 'accepted', 'declined')
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "status" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "status"
      TYPE "company_invitation_status_enum_old"
      USING ("status"::text::"company_invitation_status_enum_old")
    `);
    await queryRunner.query(`
      DROP TYPE "company_invitation_status_enum"
    `);
    await queryRunner.query(`
      ALTER TYPE "company_invitation_status_enum_old"
      RENAME TO "company_invitation_status_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "status"
      SET DEFAULT 'pending'::"company_invitation_status_enum"
    `);
  }
}
