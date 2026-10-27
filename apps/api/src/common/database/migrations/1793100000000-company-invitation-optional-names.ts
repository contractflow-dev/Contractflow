import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyInvitationOptionalNames1793100000000 implements MigrationInterface {
  name = 'CompanyInvitationOptionalNames1793100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
        ALTER COLUMN "first_name" DROP NOT NULL,
        ALTER COLUMN "last_name" DROP NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(`
      SELECT COUNT(*)::int AS count
      FROM "company_invitation"
      WHERE "first_name" IS NULL OR "last_name" IS NULL
    `);
    if (Number(count) > 0) {
      throw new Error(
        'Cannot restore NOT NULL invitation names while invitations without names exist.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "company_invitation"
        ALTER COLUMN "first_name" SET NOT NULL,
        ALTER COLUMN "last_name" SET NOT NULL
    `);
  }
}
