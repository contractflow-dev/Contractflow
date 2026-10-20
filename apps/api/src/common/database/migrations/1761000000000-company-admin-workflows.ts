import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyAdminWorkflows1761000000000
  implements MigrationInterface
{
  name = 'CompanyAdminWorkflows1761000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "company_invitation" ALTER COLUMN "accepted_at" DROP NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "status" TYPE character varying(20)
      USING "status"::text
    `);
    await queryRunner.query(`
      UPDATE "company_invitation"
      SET "status" = 'expired'
      WHERE "status" = 'pending' AND "expires_at" <= now()
    `);
    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id", row_number() OVER (
          PARTITION BY "company_id", "email"
          ORDER BY "created_at" DESC, "id" DESC
        ) AS "position"
        FROM "company_invitation"
        WHERE "status" = 'pending'
      )
      UPDATE "company_invitation" AS invitation
      SET "status" = 'expired'
      FROM ranked
      WHERE invitation."id" = ranked."id" AND ranked."position" > 1
    `);
    await queryRunner.query(
      'DROP INDEX IF EXISTS "uq_company_user_company_user"',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_company_user_active_company_user"
      ON "company_user" ("company_id", "user_id")
      WHERE "status" = 'active' AND "left_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_company_invitation_pending_company_email"
      ON "company_invitation" ("company_id", "email")
      WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE TABLE "company_audit_log" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "company_id" character varying(26) NOT NULL,
        "actor_company_user_id" character varying(26),
        "actor_user_id" character varying(26) NOT NULL,
        "action" character varying(100) NOT NULL,
        "entity_type" character varying(60) NOT NULL,
        "entity_id" character varying(26),
        "summary" character varying(500) NOT NULL,
        "changes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_company_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "fk_company_audit_log_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_company_audit_log_actor"
          FOREIGN KEY ("actor_company_user_id") REFERENCES "company_user"("id")
          ON DELETE SET NULL,
        CONSTRAINT "fk_company_audit_log_user"
          FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id")
          ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_company_audit_log_company_occurred"
      ON "company_audit_log" ("company_id", "occurred_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [auditRows] = await queryRunner.query(
      'SELECT COUNT(*)::int AS "count" FROM "company_audit_log"',
    );
    if (Number(auditRows.count) > 0) {
      throw new Error(
        'Cannot roll back company administration while company audit records exist.',
      );
    }
    const [multipleMemberships] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM "company_user"
        GROUP BY "company_id", "user_id"
        HAVING COUNT(*) > 1
      ) AS "found"
    `);
    if (multipleMemberships.found) {
      throw new Error(
        'Cannot restore unique company memberships while historical membership rows exist.',
      );
    }
    const [newInvitationStatuses] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM "company_invitation"
        WHERE "status" IN ('expired', 'revoked')
      ) AS "found"
    `);
    if (newInvitationStatuses.found) {
      throw new Error(
        'Cannot roll back invitation statuses while expired or revoked invitations exist.',
      );
    }
    const [pendingAcceptanceDates] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM "company_invitation" WHERE "accepted_at" IS NULL
      ) AS "found"
    `);
    if (pendingAcceptanceDates.found) {
      throw new Error(
        'Cannot restore required invitation acceptance timestamps while null values exist.',
      );
    }

    await queryRunner.query('DROP TABLE "company_audit_log"');
    await queryRunner.query('DROP INDEX "uq_company_invitation_pending_company_email"');
    await queryRunner.query(
      'DROP INDEX "uq_company_user_active_company_user"',
    );
    await queryRunner.query(`
      ALTER TABLE "company_invitation"
      ALTER COLUMN "status" TYPE "public"."company_invitation_status_enum"
      USING "status"::"public"."company_invitation_status_enum"
    `);
    await queryRunner.query(
      'ALTER TABLE "company_invitation" ALTER COLUMN "accepted_at" SET NOT NULL',
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_company_user_company_user"
      ON "company_user" ("company_id", "user_id")
    `);
  }
}
