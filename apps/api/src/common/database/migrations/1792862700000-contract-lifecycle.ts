import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractLifecycle1792862700000 implements MigrationInterface {
  name = 'ContractLifecycle1792862700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contract"
        ADD COLUMN "created_by_company_id" character varying(26),
        ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "deleted_by_company_user_id" character varying(26),
        ADD CONSTRAINT "fk_contract_created_by_company"
          FOREIGN KEY ("created_by_company_id") REFERENCES "company"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_contract_deleted_by_company_user"
          FOREIGN KEY ("deleted_by_company_user_id") REFERENCES "company_user"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract"
        ALTER COLUMN "description" DROP NOT NULL,
        ALTER COLUMN "advance_payment_rate_bps" DROP NOT NULL,
        ALTER COLUMN "liquidated_damages_per_day_minor" DROP NOT NULL,
        ALTER COLUMN "revised_end_date" DROP NOT NULL,
        ALTER COLUMN "actual_completion_date" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_party"
        ALTER COLUMN "signatory_first_name" DROP NOT NULL,
        ALTER COLUMN "signatory_last_name" DROP NOT NULL,
        ALTER COLUMN "signatory_title" DROP NOT NULL,
        ALTER COLUMN "signed_at" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_status_history"
        ALTER COLUMN "from_status" DROP NOT NULL,
        ALTER COLUMN "reason" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "contract_workspace" (
        "contract_id" character varying(26) NOT NULL,
        "workspace" character varying(20) NOT NULL,
        "created_by_company_user_id" character varying(26),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_contract_workspace" PRIMARY KEY ("contract_id", "workspace"),
        CONSTRAINT "ck_contract_workspace_type"
          CHECK ("workspace" IN ('project', 'hse', 'finance')),
        CONSTRAINT "fk_contract_workspace_contract"
          FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_workspace_creator"
          FOREIGN KEY ("created_by_company_user_id") REFERENCES "company_user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "contract_workspace" (
        "contract_id", "workspace", "created_by_company_user_id"
      )
      SELECT
        contract."id",
        workspace."workspace",
        NULL
      FROM "contract"
      CROSS JOIN (VALUES ('project'), ('hse'), ('finance')) AS workspace("workspace")
    `);

    await queryRunner.query(`
      CREATE TABLE "contract_party_invitation" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "source_contract_party_id" character varying(26) NOT NULL,
        "source_company_id" character varying(26) NOT NULL,
        "target_company_id" character varying(26) NOT NULL,
        "invited_by_company_user_id" character varying(26) NOT NULL,
        "accepted_by_company_user_id" character varying(26),
        "party_type" character varying(20) NOT NULL,
        "email" character varying(320) NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_contract_party_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "ck_contract_party_invitation_type"
          CHECK ("party_type" IN ('contractor', 'subcontractor')),
        CONSTRAINT "ck_contract_party_invitation_status"
          CHECK ("status" IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')),
        CONSTRAINT "fk_contract_party_invitation_source"
          FOREIGN KEY ("source_contract_party_id", "source_company_id")
          REFERENCES "contract_party"("id", "company_id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_party_invitation_target"
          FOREIGN KEY ("target_company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_party_invitation_inviter"
          FOREIGN KEY ("invited_by_company_user_id", "source_company_id")
          REFERENCES "company_user"("id", "company_id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_party_invitation_responder"
          FOREIGN KEY ("accepted_by_company_user_id")
          REFERENCES "company_user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_contract_party_invitation_token"
      ON "contract_party_invitation" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_contract_party_invitation_pending"
      ON "contract_party_invitation" (
        "source_contract_party_id", "target_company_id", "party_type"
      )
      WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_contract_party_invitation_target_status"
      ON "contract_party_invitation" ("target_company_id", "status", "expires_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_contract_status_history_contract_changed"
      ON "contract_status_history" ("contract_id", "changed_at", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [existingInvitations] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count" FROM "contract_party_invitation"
    `);
    if (Number(existingInvitations.count) > 0) {
      throw new Error(
        'Cannot roll back contract lifecycle while contract-party invitation records exist.',
      );
    }
    const [existingWorkspaces] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count" FROM "contract_workspace"
    `);
    if (Number(existingWorkspaces.count) > 0) {
      throw new Error(
        'Cannot roll back contract lifecycle while workspace records exist.',
      );
    }
    const [newContractMetadata] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM "contract"
        WHERE "created_by_company_id" IS NOT NULL OR "deleted_at" IS NOT NULL
          OR "deleted_by_company_user_id" IS NOT NULL
      ) AS "found"
    `);
    if (newContractMetadata.found) {
      throw new Error(
        'Cannot roll back contract lifecycle while creator or deletion metadata is in use.',
      );
    }

    const nullableColumns = [
      ['contract', 'description'],
      ['contract', 'advance_payment_rate_bps'],
      ['contract', 'liquidated_damages_per_day_minor'],
      ['contract', 'revised_end_date'],
      ['contract', 'actual_completion_date'],
      ['contract_party', 'signatory_first_name'],
      ['contract_party', 'signatory_last_name'],
      ['contract_party', 'signatory_title'],
      ['contract_party', 'signed_at'],
      ['contract_status_history', 'from_status'],
      ['contract_status_history', 'reason'],
    ] as const;
    for (const [table, column] of nullableColumns) {
      const [nullableRows] = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM "${table}" WHERE "${column}" IS NULL) AS "found"`,
      );
      if (nullableRows.found) {
        throw new Error(
          `Cannot restore NOT NULL on "${table}"."${column}" while null values exist.`,
        );
      }
    }

    await queryRunner.query(
      'DROP INDEX "ix_contract_status_history_contract_changed"',
    );
    await queryRunner.query(
      'DROP INDEX "ix_contract_party_invitation_target_status"',
    );
    await queryRunner.query(
      'DROP INDEX "uq_contract_party_invitation_token"',
    );
    await queryRunner.query('DROP TABLE "contract_party_invitation"');
    await queryRunner.query('DROP TABLE "contract_workspace"');
    await queryRunner.query(`
      ALTER TABLE "contract_status_history"
        ALTER COLUMN "from_status" SET NOT NULL,
        ALTER COLUMN "reason" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_party"
        ALTER COLUMN "signatory_first_name" SET NOT NULL,
        ALTER COLUMN "signatory_last_name" SET NOT NULL,
        ALTER COLUMN "signatory_title" SET NOT NULL,
        ALTER COLUMN "signed_at" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract"
        ALTER COLUMN "description" SET NOT NULL,
        ALTER COLUMN "advance_payment_rate_bps" SET NOT NULL,
        ALTER COLUMN "liquidated_damages_per_day_minor" SET NOT NULL,
        ALTER COLUMN "revised_end_date" SET NOT NULL,
        ALTER COLUMN "actual_completion_date" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract"
        DROP CONSTRAINT "fk_contract_deleted_by_company_user",
        DROP CONSTRAINT "fk_contract_created_by_company",
        DROP COLUMN "deleted_by_company_user_id",
        DROP COLUMN "deleted_at",
        DROP COLUMN "created_by_company_id"
    `);
  }
}
