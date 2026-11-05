import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableActivityRequestContext1791882600002 implements MigrationInterface {
  name = 'NullableActivityRequestContext1791882600002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "ip_address" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "user_agent" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "request_id" DROP NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [missingContext] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "activity_log"
      WHERE "ip_address" IS NULL
        OR "user_agent" IS NULL
        OR "request_id" IS NULL
    `);
    if (Number(missingContext.count) > 0) {
      throw new Error(
        'Cannot require activity request context while audit records without that context exist.',
      );
    }

    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "request_id" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "user_agent" SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "activity_log" ALTER COLUMN "ip_address" SET NOT NULL',
    );
  }
}
