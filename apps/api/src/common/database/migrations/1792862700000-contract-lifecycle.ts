import type { MigrationInterface, QueryRunner } from 'typeorm';

type ExpectedColumn = [
  name: string,
  type: string,
  notNull: boolean,
  defaultExpression: string | null,
];

/**
 * Columns this migration adds may already exist (for example when the schema
 * was created outside migration history). An existing column is accepted
 * only when it already matches the definition the migration would create.
 */
async function assertExistingColumnsMatch(
  queryRunner: QueryRunner,
  table: string,
  expected: ExpectedColumn[],
): Promise<void> {
  const existing = (await queryRunner.query(
    `
      SELECT a.attname AS "name",
        format_type(a.atttypid, a.atttypmod) AS "type",
        a.attnotnull AS "notNull",
        pg_get_expr(d.adbin, d.adrelid) AS "defaultExpression"
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = ANY($2)
    `,
    [`"${table}"`, expected.map(([name]) => name)],
  )) as Array<{
    name: string;
    type: string;
    notNull: boolean;
    defaultExpression: string | null;
  }>;
  for (const column of existing) {
    const match = expected.find(([name]) => name === column.name);
    if (!match) continue;
    const [, type, notNull, defaultExpression] = match;
    if (
      column.type !== type ||
      column.notNull !== notNull ||
      column.defaultExpression !== defaultExpression
    ) {
      throw new Error(
        `Existing column "${table}"."${column.name}" does not match the migration schema.`,
      );
    }
  }
}

export class ContractLifecycle1792862700000 implements MigrationInterface {
  name = 'ContractLifecycle1792862700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await assertExistingColumnsMatch(queryRunner, 'contract', [
      ['created_by_company_id', 'character varying(26)', false, null],
      ['deleted_at', 'timestamp with time zone', false, null],
      ['deleted_by_company_user_id', 'character varying(26)', false, null],
    ]);
    await queryRunner.query(`
      ALTER TABLE "contract"
        ADD COLUMN IF NOT EXISTS "created_by_company_id" character varying(26),
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "deleted_by_company_user_id" character varying(26)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "contract" ADD CONSTRAINT "fk_contract_created_by_company"
          FOREIGN KEY ("created_by_company_id") REFERENCES "company"("id") ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"contract"'::regclass
              AND conname = 'fk_contract_created_by_company'
              AND convalidated
              AND pg_get_constraintdef(oid, true) = 'FOREIGN KEY (created_by_company_id) REFERENCES company(id) ON DELETE RESTRICT'
          ) THEN
            RAISE EXCEPTION 'Existing constraint "fk_contract_created_by_company" on "contract" does not match the migration definition.';
          END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "contract" ADD CONSTRAINT "fk_contract_deleted_by_company_user"
          FOREIGN KEY ("deleted_by_company_user_id") REFERENCES "company_user"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"contract"'::regclass
              AND conname = 'fk_contract_deleted_by_company_user'
              AND convalidated
              AND pg_get_constraintdef(oid, true) = 'FOREIGN KEY (deleted_by_company_user_id) REFERENCES company_user(id) ON DELETE SET NULL'
          ) THEN
            RAISE EXCEPTION 'Existing constraint "fk_contract_deleted_by_company_user" on "contract" does not match the migration definition.';
          END IF;
      END $$;
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

    // Existing workspace rows are authoritative: removing a workspace deletes
    // its row, so seeding an existing table would re-enable removed ones.
    const [workspaceTable] = (await queryRunner.query(
      `SELECT to_regclass('"contract_workspace"') IS NOT NULL AS "present"`,
    )) as Array<{ present: boolean }>;
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_workspace" (
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
    if (!workspaceTable?.present) {
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
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_party_invitation" (
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
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_party_invitation_token"
      ON "contract_party_invitation" ("token_hash")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"uq_contract_party_invitation_token"')
            AND ix.indrelid = '"contract_party_invitation"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE UNIQUE INDEX uq_contract_party_invitation_token ON contract_party_invitation USING btree (token_hash)'
        ) THEN
          RAISE EXCEPTION 'Existing index "uq_contract_party_invitation_token" on "contract_party_invitation" does not match the migration definition.';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_party_invitation_pending"
      ON "contract_party_invitation" (
        "source_contract_party_id", "target_company_id", "party_type"
      )
      WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"uq_contract_party_invitation_pending"')
            AND ix.indrelid = '"contract_party_invitation"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE UNIQUE INDEX uq_contract_party_invitation_pending ON contract_party_invitation USING btree (source_contract_party_id, target_company_id, party_type) WHERE status::text = ''pending''::text'
        ) THEN
          RAISE EXCEPTION 'Existing index "uq_contract_party_invitation_pending" on "contract_party_invitation" does not match the migration definition.';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_contract_party_invitation_target_status"
      ON "contract_party_invitation" ("target_company_id", "status", "expires_at")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"ix_contract_party_invitation_target_status"')
            AND ix.indrelid = '"contract_party_invitation"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE INDEX ix_contract_party_invitation_target_status ON contract_party_invitation USING btree (target_company_id, status, expires_at)'
        ) THEN
          RAISE EXCEPTION 'Existing index "ix_contract_party_invitation_target_status" on "contract_party_invitation" does not match the migration definition.';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "ix_contract_status_history_contract_changed"
      ON "contract_status_history" ("contract_id", "changed_at", "id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index ix
          WHERE ix.indexrelid = to_regclass('"ix_contract_status_history_contract_changed"')
            AND ix.indrelid = '"contract_status_history"'::regclass
            AND ix.indisvalid
            AND pg_get_indexdef(ix.indexrelid, 0, true) = 'CREATE INDEX ix_contract_status_history_contract_changed ON contract_status_history USING btree (contract_id, changed_at, id)'
        ) THEN
          RAISE EXCEPTION 'Existing index "ix_contract_status_history_contract_changed" on "contract_status_history" does not match the migration definition.';
        END IF;
      END $$;
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
