import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stages and Milestones workflow: planning, submissions with evidence, client
 * decisions (approve, partially approve, reject) and outstanding work.
 *
 * Existing tables:
 * - `contract_stage` and `milestone` were created with every column NOT NULL,
 *   although the ERD makes descriptions, actual dates and the submission and
 *   approval columns nullable. A new milestone has no submission, so those
 *   columns become nullable. No value changes.
 * - New milestone columns: acceptance criteria, deliverables, planned and
 *   actual start dates, an optional measurable target (quantity and unit), and
 *   the client-approved share (`approved_bps`, `approved_quantity`), kept apart
 *   from the contractor-reported `progress_bps`.
 *   Existing milestones already approved or completed are recorded as fully
 *   accepted (`approved_bps` 10000); every other existing row starts at 0.
 * - `legacy_status` (nullable) keeps a milestone's original status when the
 *   controlled legacy transition moves it into the workflow; this migration
 *   moves nothing. The revert refuses once any milestone has one.
 * - Status values: `partially_approved` and `rejected` for milestones,
 *   `on_hold` for stages.
 *
 * New history tables. Each row is written once, in the same transaction as
 * the milestone change and its activity entry:
 * - `milestone_submission`: every submission, numbered per milestone, linked
 *   to the decision it answers.
 * - `milestone_submission_evidence`: the document versions submitted, so a
 *   later version never replaces earlier evidence.
 * - `milestone_decision`: one decision per submission (unique), with its
 *   reason, approved share and approved work.
 * - `milestone_outstanding_item`: work a partial approval left open, in the
 *   order the client listed it. Its acceptance is recorded once, with the
 *   accepting decision.
 * - `milestone_submission_item`: which outstanding items a resubmission
 *   covered.
 *
 * History rows follow their contract (ON DELETE CASCADE from `contract`, as
 * every contract-owned table does); other references use NO ACTION, so a
 * submission, decision or member can't be removed from under its history.
 *
 * The database keeps history immutable: an UPDATE of a submission, decision,
 * evidence row or covered item is refused, and an outstanding item can only
 * be accepted, once. (Deletes are refused by the application's append-only
 * repositories; the database still lets a contract's deletion cascade.)
 */
export class MilestoneWorkflow1793800000000 implements MigrationInterface {
  name = 'MilestoneWorkflow1793800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Status values. Added, never used in this transaction.
    await queryRunner.query(
      `ALTER TYPE "public"."milestone_status_enum" ADD VALUE IF NOT EXISTS 'partially_approved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."milestone_status_enum" ADD VALUE IF NOT EXISTS 'rejected'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."contract_stage_status_enum" ADD VALUE IF NOT EXISTS 'on_hold'`,
    );

    await queryRunner.query(`
      ALTER TABLE "contract_stage"
        ALTER COLUMN "description" DROP NOT NULL,
        ALTER COLUMN "actual_start_date" DROP NOT NULL,
        ALTER COLUMN "actual_end_date" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "milestone"
        ALTER COLUMN "description" DROP NOT NULL,
        ALTER COLUMN "amount_minor" DROP NOT NULL,
        ALTER COLUMN "currency_code" DROP NOT NULL,
        ALTER COLUMN "revised_due_date" DROP NOT NULL,
        ALTER COLUMN "completed_date" DROP NOT NULL,
        ALTER COLUMN "submitted_at" DROP NOT NULL,
        ALTER COLUMN "submitted_by_id" DROP NOT NULL,
        ALTER COLUMN "approved_at" DROP NOT NULL,
        ALTER COLUMN "approved_by_id" DROP NOT NULL,
        ALTER COLUMN "rejection_reason" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "acceptance_criteria" text,
        ADD COLUMN IF NOT EXISTS "deliverables" text,
        ADD COLUMN IF NOT EXISTS "planned_start_date" date,
        ADD COLUMN IF NOT EXISTS "actual_start_date" date,
        ADD COLUMN IF NOT EXISTS "target_quantity" integer,
        ADD COLUMN IF NOT EXISTS "quantity_unit" character varying(40),
        ADD COLUMN IF NOT EXISTS "approved_bps" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "approved_quantity" integer,
        ADD COLUMN IF NOT EXISTS "legacy_status" character varying(30)
    `);
    // Milestones a client already approved (or completed) before this
    // migration are fully accepted; without this they would read as 0% and
    // pull their stage's progress down. No other value changes.
    await queryRunner.query(`
      UPDATE "milestone"
        SET "approved_bps" = 10000
        WHERE "status"::text IN ('approved', 'completed')
    `);
    await queryRunner.query(`
      ALTER TABLE "milestone"
        ADD CONSTRAINT "ck_milestone_approved_bps"
          CHECK ("approved_bps" BETWEEN 0 AND 10000),
        ADD CONSTRAINT "ck_milestone_target_quantity"
          CHECK ("target_quantity" IS NULL OR "target_quantity" > 0),
        ADD CONSTRAINT "ck_milestone_approved_quantity"
          CHECK (
            "approved_quantity" IS NULL
            OR ("target_quantity" IS NOT NULL AND "approved_quantity" BETWEEN 0 AND "target_quantity")
          )
    `);

    await queryRunner.query(`
      CREATE TABLE "milestone_submission" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "milestone_id" character varying(26) NOT NULL,
        "sequence" integer NOT NULL,
        "submission_type" character varying(20) NOT NULL,
        "previous_decision_id" character varying(26),
        "submitted_by_id" character varying(26) NOT NULL,
        "submitted_by_party_id" character varying(26) NOT NULL,
        "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "notes" text NOT NULL,
        "reported_progress_bps" integer,
        CONSTRAINT "pk_milestone_submission" PRIMARY KEY ("id"),
        CONSTRAINT "uq_milestone_submission_sequence" UNIQUE ("milestone_id", "sequence"),
        CONSTRAINT "ck_milestone_submission_type"
          CHECK ("submission_type" IN ('initial', 'resubmission', 'outstanding_work')),
        CONSTRAINT "ck_milestone_submission_sequence" CHECK ("sequence" > 0),
        CONSTRAINT "ck_milestone_submission_follows_decision"
          CHECK (("submission_type" = 'initial') = ("previous_decision_id" IS NULL)),
        CONSTRAINT "ck_milestone_submission_progress"
          CHECK ("reported_progress_bps" IS NULL OR "reported_progress_bps" BETWEEN 0 AND 10000),
        CONSTRAINT "fk_milestone_submission_contract" FOREIGN KEY ("contract_id")
          REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_milestone_submission_milestone" FOREIGN KEY ("milestone_id")
          REFERENCES "milestone"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_submission_submitted_by" FOREIGN KEY ("submitted_by_id")
          REFERENCES "company_user"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_submission_party" FOREIGN KEY ("submitted_by_party_id")
          REFERENCES "contract_party"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "milestone_decision" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "milestone_id" character varying(26) NOT NULL,
        "submission_id" character varying(26) NOT NULL,
        "decision" character varying(20) NOT NULL,
        "reason" text,
        "approved_bps" integer NOT NULL,
        "cumulative_approved_bps" integer NOT NULL,
        "approved_work" text,
        "approved_quantity" integer,
        "decided_by_id" character varying(26) NOT NULL,
        "decided_by_party_id" character varying(26) NOT NULL,
        "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_milestone_decision" PRIMARY KEY ("id"),
        CONSTRAINT "uq_milestone_decision_submission" UNIQUE ("submission_id"),
        CONSTRAINT "ck_milestone_decision_type"
          CHECK ("decision" IN ('approved', 'partially_approved', 'rejected')),
        CONSTRAINT "ck_milestone_decision_bps"
          CHECK ("approved_bps" BETWEEN 0 AND 10000 AND "cumulative_approved_bps" BETWEEN 0 AND 10000),
        CONSTRAINT "ck_milestone_decision_reason"
          CHECK ("decision" = 'approved' OR length(btrim(coalesce("reason", ''))) > 0),
        CONSTRAINT "ck_milestone_decision_approved"
          CHECK ("decision" <> 'approved' OR "cumulative_approved_bps" = 10000),
        CONSTRAINT "ck_milestone_decision_partial"
          CHECK (
            "decision" <> 'partially_approved'
            OR ("approved_bps" > 0 AND "cumulative_approved_bps" < 10000
                AND length(btrim(coalesce("approved_work", ''))) > 0)
          ),
        CONSTRAINT "ck_milestone_decision_rejected"
          CHECK ("decision" <> 'rejected' OR ("approved_bps" = 0 AND "approved_quantity" IS NULL)),
        CONSTRAINT "fk_milestone_decision_contract" FOREIGN KEY ("contract_id")
          REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_milestone_decision_milestone" FOREIGN KEY ("milestone_id")
          REFERENCES "milestone"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_decision_submission" FOREIGN KEY ("submission_id")
          REFERENCES "milestone_submission"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_decision_decided_by" FOREIGN KEY ("decided_by_id")
          REFERENCES "company_user"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_decision_party" FOREIGN KEY ("decided_by_party_id")
          REFERENCES "contract_party"("id") ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "milestone_submission"
        ADD CONSTRAINT "fk_milestone_submission_previous_decision"
          FOREIGN KEY ("previous_decision_id")
          REFERENCES "milestone_decision"("id") ON DELETE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "milestone_submission_evidence" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "submission_id" character varying(26) NOT NULL,
        "document_id" character varying(26) NOT NULL,
        "document_version_id" character varying(26) NOT NULL,
        "caption" character varying(255),
        "position" integer NOT NULL,
        CONSTRAINT "pk_milestone_submission_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "uq_milestone_submission_evidence_position" UNIQUE ("submission_id", "position"),
        CONSTRAINT "uq_milestone_submission_evidence_document" UNIQUE ("submission_id", "document_id"),
        CONSTRAINT "fk_milestone_submission_evidence_contract" FOREIGN KEY ("contract_id")
          REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_milestone_submission_evidence_submission" FOREIGN KEY ("submission_id")
          REFERENCES "milestone_submission"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_submission_evidence_document" FOREIGN KEY ("document_id")
          REFERENCES "document"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_submission_evidence_version" FOREIGN KEY ("document_version_id")
          REFERENCES "document_version"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "milestone_outstanding_item" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "milestone_id" character varying(26) NOT NULL,
        "raised_by_decision_id" character varying(26) NOT NULL,
        "description" text NOT NULL,
        "quantity" integer,
        "position" integer NOT NULL,
        "accepted_by_decision_id" character varying(26),
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_milestone_outstanding_item" PRIMARY KEY ("id"),
        CONSTRAINT "uq_milestone_outstanding_item_position" UNIQUE ("raised_by_decision_id", "position"),
        CONSTRAINT "ck_milestone_outstanding_item_quantity"
          CHECK ("quantity" IS NULL OR "quantity" > 0),
        CONSTRAINT "ck_milestone_outstanding_item_acceptance"
          CHECK (("accepted_by_decision_id" IS NULL) = ("accepted_at" IS NULL)),
        CONSTRAINT "ck_milestone_outstanding_item_not_self_accepted"
          CHECK ("accepted_by_decision_id" IS NULL OR "accepted_by_decision_id" <> "raised_by_decision_id"),
        CONSTRAINT "fk_milestone_outstanding_item_contract" FOREIGN KEY ("contract_id")
          REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_milestone_outstanding_item_milestone" FOREIGN KEY ("milestone_id")
          REFERENCES "milestone"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_outstanding_item_raised_by" FOREIGN KEY ("raised_by_decision_id")
          REFERENCES "milestone_decision"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_outstanding_item_accepted_by" FOREIGN KEY ("accepted_by_decision_id")
          REFERENCES "milestone_decision"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "milestone_submission_item" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "submission_id" character varying(26) NOT NULL,
        "outstanding_item_id" character varying(26) NOT NULL,
        CONSTRAINT "pk_milestone_submission_item" PRIMARY KEY ("id"),
        CONSTRAINT "uq_milestone_submission_item" UNIQUE ("submission_id", "outstanding_item_id"),
        CONSTRAINT "fk_milestone_submission_item_contract" FOREIGN KEY ("contract_id")
          REFERENCES "contract"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_milestone_submission_item_submission" FOREIGN KEY ("submission_id")
          REFERENCES "milestone_submission"("id") ON DELETE NO ACTION,
        CONSTRAINT "fk_milestone_submission_item_item" FOREIGN KEY ("outstanding_item_id")
          REFERENCES "milestone_outstanding_item"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "public"."milestone_history_immutable"()
      RETURNS trigger LANGUAGE plpgsql AS $immutable$
      BEGIN
        RAISE EXCEPTION 'Milestone history is append-only: % rows cannot be changed', TG_TABLE_NAME
          USING ERRCODE = 'restrict_violation';
      END
      $immutable$
    `);
    for (const table of [
      'milestone_submission',
      'milestone_decision',
      'milestone_submission_evidence',
      'milestone_submission_item',
    ]) {
      await queryRunner.query(`
        CREATE TRIGGER "tr_${table}_immutable"
          BEFORE UPDATE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION "public"."milestone_history_immutable"()
      `);
    }
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "public"."milestone_outstanding_item_accept_once"()
      RETURNS trigger LANGUAGE plpgsql AS $accept_once$
      BEGIN
        IF OLD."accepted_by_decision_id" IS NOT NULL
          OR NEW."accepted_by_decision_id" IS NULL
          OR NEW."id" <> OLD."id"
          OR NEW."contract_id" <> OLD."contract_id"
          OR NEW."milestone_id" <> OLD."milestone_id"
          OR NEW."raised_by_decision_id" <> OLD."raised_by_decision_id"
          OR NEW."description" <> OLD."description"
          OR NEW."quantity" IS DISTINCT FROM OLD."quantity"
          OR NEW."position" <> OLD."position"
          OR NEW."created_at" <> OLD."created_at"
        THEN
          RAISE EXCEPTION 'An outstanding item can only be accepted, once'
            USING ERRCODE = 'restrict_violation';
        END IF;
        RETURN NEW;
      END
      $accept_once$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "tr_milestone_outstanding_item_accept_once"
        BEFORE UPDATE ON "milestone_outstanding_item"
        FOR EACH ROW EXECUTE FUNCTION "public"."milestone_outstanding_item_accept_once"()
    `);

    for (const statement of [
      'CREATE INDEX IF NOT EXISTS "ix_contract_stage_contract_sequence" ON "contract_stage" ("contract_id", "sequence")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_contract_stage" ON "milestone" ("contract_id", "contract_stage_id", "sequence")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_contract_status" ON "milestone" ("contract_id", "status")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_submission_milestone" ON "milestone_submission" ("contract_id", "milestone_id", "sequence")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_decision_milestone" ON "milestone_decision" ("contract_id", "milestone_id", "decided_at")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_submission_evidence_submission" ON "milestone_submission_evidence" ("submission_id")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_outstanding_item_milestone" ON "milestone_outstanding_item" ("contract_id", "milestone_id")',
      'CREATE INDEX IF NOT EXISTS "ix_milestone_submission_item_item" ON "milestone_submission_item" ("outstanding_item_id")',
    ]) {
      await queryRunner.query(statement);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse to lose workflow data or values the old schema can't hold.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "milestone_submission")
          OR EXISTS (SELECT 1 FROM "milestone" WHERE "status"::text IN ('partially_approved', 'rejected'))
          OR EXISTS (SELECT 1 FROM "milestone" WHERE "legacy_status" IS NOT NULL)
          OR EXISTS (SELECT 1 FROM "contract_stage" WHERE "status"::text = 'on_hold')
          OR EXISTS (
            SELECT 1 FROM "milestone"
            WHERE "description" IS NULL OR "amount_minor" IS NULL OR "currency_code" IS NULL
              OR "revised_due_date" IS NULL OR "completed_date" IS NULL OR "submitted_at" IS NULL
              OR "submitted_by_id" IS NULL OR "approved_at" IS NULL OR "approved_by_id" IS NULL
              OR "rejection_reason" IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM "contract_stage"
            WHERE "description" IS NULL OR "actual_start_date" IS NULL OR "actual_end_date" IS NULL
          )
        THEN
          RAISE EXCEPTION 'MilestoneWorkflow1793800000000 cannot be reverted: milestones or stages use the workflow (submissions, new statuses or empty optional columns). Export and remove that data first.';
        END IF;
      END
      $$
    `);

    for (const table of [
      'milestone_submission',
      'milestone_decision',
      'milestone_submission_evidence',
      'milestone_submission_item',
    ]) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "tr_${table}_immutable" ON "${table}"`,
      );
    }
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "tr_milestone_outstanding_item_accept_once" ON "milestone_outstanding_item"',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS "public"."milestone_outstanding_item_accept_once"()',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS "public"."milestone_history_immutable"()',
    );

    for (const table of [
      'milestone_submission_item',
      'milestone_outstanding_item',
      'milestone_submission_evidence',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await queryRunner.query(
      'ALTER TABLE "milestone_submission" DROP CONSTRAINT IF EXISTS "fk_milestone_submission_previous_decision"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "milestone_decision"');
    await queryRunner.query('DROP TABLE IF EXISTS "milestone_submission"');
    for (const index of [
      'ix_contract_stage_contract_sequence',
      'ix_milestone_contract_stage',
      'ix_milestone_contract_status',
    ]) {
      await queryRunner.query(`DROP INDEX IF EXISTS "public"."${index}"`);
    }

    await queryRunner.query(`
      ALTER TABLE "milestone"
        DROP CONSTRAINT IF EXISTS "ck_milestone_approved_quantity",
        DROP CONSTRAINT IF EXISTS "ck_milestone_target_quantity",
        DROP CONSTRAINT IF EXISTS "ck_milestone_approved_bps",
        DROP COLUMN IF EXISTS "legacy_status",
        DROP COLUMN IF EXISTS "approved_quantity",
        DROP COLUMN IF EXISTS "approved_bps",
        DROP COLUMN IF EXISTS "quantity_unit",
        DROP COLUMN IF EXISTS "target_quantity",
        DROP COLUMN IF EXISTS "actual_start_date",
        DROP COLUMN IF EXISTS "planned_start_date",
        DROP COLUMN IF EXISTS "deliverables",
        DROP COLUMN IF EXISTS "acceptance_criteria",
        ALTER COLUMN "description" SET NOT NULL,
        ALTER COLUMN "amount_minor" SET NOT NULL,
        ALTER COLUMN "currency_code" SET NOT NULL,
        ALTER COLUMN "revised_due_date" SET NOT NULL,
        ALTER COLUMN "completed_date" SET NOT NULL,
        ALTER COLUMN "submitted_at" SET NOT NULL,
        ALTER COLUMN "submitted_by_id" SET NOT NULL,
        ALTER COLUMN "approved_at" SET NOT NULL,
        ALTER COLUMN "approved_by_id" SET NOT NULL,
        ALTER COLUMN "rejection_reason" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_stage"
        ALTER COLUMN "description" SET NOT NULL,
        ALTER COLUMN "actual_start_date" SET NOT NULL,
        ALTER COLUMN "actual_end_date" SET NOT NULL
    `);

    // PostgreSQL can't drop an enum value: recreate the types without them.
    await queryRunner.query(`
      ALTER TYPE "public"."milestone_status_enum" RENAME TO "milestone_status_enum_workflow";
      CREATE TYPE "public"."milestone_status_enum" AS ENUM('planned', 'active', 'in_progress', 'pending_approval', 'approved', 'completed', 'delayed', 'at_risk', 'on_hold', 'cancelled');
      ALTER TABLE "milestone" ALTER COLUMN "status" TYPE "public"."milestone_status_enum" USING "status"::text::"public"."milestone_status_enum";
      DROP TYPE "public"."milestone_status_enum_workflow";
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."contract_stage_status_enum" RENAME TO "contract_stage_status_enum_workflow";
      CREATE TYPE "public"."contract_stage_status_enum" AS ENUM('planned', 'active', 'in_progress', 'pending_approval', 'completed', 'delayed', 'cancelled');
      ALTER TABLE "contract_stage" ALTER COLUMN "status" TYPE "public"."contract_stage_status_enum" USING "status"::text::"public"."contract_stage_status_enum";
      DROP TYPE "public"."contract_stage_status_enum_workflow";
    `);
  }
}
