import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Fixed ids of the seeded system lifecycle, so every database shares them. */
const TEMPLATE_ID = '01M8F5BQ8NHW84KWCM5E50B87E';
const VERSION_ID = '01M8F5BQ8RDRGT1FZEA8MMPVYG';

/**
 * The standard oil and gas contract lifecycle: nine stages whose weights
 * total 10,000 basis points. Contract Award is weighted 0 and completes when
 * the contract is activated.
 */
const SEED_STAGES: Array<
  [id: string, code: string, name: string, weightBps: number]
> = [
  [
    '01M8F5BQ8R3KWHWNW7NNR4JK9C',
    'contract_award',
    'Contract Award and Agreement Execution',
    0,
  ],
  [
    '01M8F5BQ8S7AC0FXMSRGX50BXB',
    'mobilisation',
    'Mobilisation and Contract Readiness',
    800,
  ],
  [
    '01M8F5BQ8SFWWVMS81JHRXA6PE',
    'contract_execution',
    'Contract Execution and Service Delivery',
    3500,
  ],
  [
    '01M8F5BQ8SSE81K7HQ2ZAE61GT',
    'performance_monitoring',
    'Performance Monitoring and Progress Reporting',
    800,
  ],
  [
    '01M8F5BQ8TEY1ND5KTACC6CRM4',
    'change_management',
    'Contract Change and Variation Management',
    500,
  ],
  [
    '01M8F5BQ8TZK8GH68QQW7XET6A',
    'inspection_acceptance',
    'Inspection, Testing and Acceptance',
    1500,
  ],
  [
    '01M8F5BQ8TPFQZZR5WW8ZY49MH',
    'commercial_reconciliation',
    'Invoicing, Payment and Commercial Reconciliation',
    1200,
  ],
  [
    '01M8F5BQ8VRD7W8WVR0XBMY7MV',
    'contract_closeout',
    'Handover, Demobilisation and Contract Close-Out',
    1000,
  ],
  [
    '01M8F5BQ8XG81XEK9FXG0JCTVN',
    'post_contract_obligations',
    'Warranty, Defects Liability and Post-Contract Obligations',
    700,
  ],
];

const STAGE_CODES = SEED_STAGES.map(([, code]) => `'${code}'`).join(', ');
const HISTORY_EVENTS =
  "'initialised', 'status_changed', 'applicability_changed', 'weight_changed', 'dates_changed'";

/**
 * Contract lifecycle templates (decisions D-2 to D-12, 27 November 2026).
 *
 * Templates
 * - `lifecycle_template` and its `lifecycle_template_version`s, each with its
 *   `lifecycle_template_stage`s. Only system templates exist for now (D-2):
 *   a CHECK keeps owner_kind = 'system' with no owning company; company
 *   templates are a later change of that CHECK, not of the tables.
 * - A published or retired version can't change: its stages can't be added,
 *   changed or removed (trigger). At most one version per template is
 *   published.
 * - Seeds the system template, version 1, published, with the nine stages.
 *
 * Contracts and their stages
 * - `contract.lifecycle_template_version_id`: the version a contract's
 *   stages were copied from; null for older contracts, which keep their
 *   stages exactly as they are (D-10).
 * - `contract_stage` gains the lifecycle stage it was copied from
 *   (`stage_code`, `template_stage_id`) and whether it applies to the
 *   contract, with the reason, who decided and when (D-7). A stage that
 *   doesn't apply needs a reason. Weights are 0 to 10,000.
 * - `contract_stage_history`: one append-only row per stage event (copied
 *   from the template, status, applicability, weight or dates changed),
 *   written in the same transaction as the change and its activity entry.
 *   Updates are refused by a trigger.
 *
 * Contract status (D-12)
 * - `defects_liability` is added between active and completed, in the
 *   contract status and its history.
 *
 * Existing rows are not changed: older stages apply, with no code. Stage
 * sequence numbers are not made unique, because older contracts may already
 * repeat one. `down` refuses while any contract or history row uses the
 * defects_liability status.
 */
export class ContractLifecycleTemplates1794100000000 implements MigrationInterface {
  name = 'ContractLifecycleTemplates1794100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // --- Contract status (D-12). Added, never used in this transaction. ----
    for (const type of [
      'contract_status_enum',
      'contract_status_history_from_status_enum',
      'contract_status_history_to_status_enum',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "public"."${type}" ADD VALUE IF NOT EXISTS 'defects_liability' BEFORE 'completed'`,
      );
    }

    // --- Templates ----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "lifecycle_template" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "code" character varying(60) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "owner_kind" character varying(20) NOT NULL DEFAULT 'system',
        "owner_company_id" character varying(26),
        CONSTRAINT "pk_lifecycle_template" PRIMARY KEY ("id"),
        CONSTRAINT "uq_lifecycle_template_code" UNIQUE ("code"),
        CONSTRAINT "ck_lifecycle_template_system_only"
          CHECK ("owner_kind" = 'system' AND "owner_company_id" IS NULL),
        CONSTRAINT "fk_lifecycle_template_owner_company"
          FOREIGN KEY ("owner_company_id") REFERENCES "company"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "lifecycle_template_version" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lifecycle_template_id" character varying(26) NOT NULL,
        "version_number" integer NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_lifecycle_template_version" PRIMARY KEY ("id"),
        CONSTRAINT "uq_lifecycle_template_version_number"
          UNIQUE ("lifecycle_template_id", "version_number"),
        CONSTRAINT "ck_lifecycle_template_version_status"
          CHECK ("status" IN ('draft', 'published', 'retired')),
        CONSTRAINT "ck_lifecycle_template_version_published_at"
          CHECK ("status" = 'draft' OR "published_at" IS NOT NULL),
        CONSTRAINT "fk_lifecycle_template_version_template"
          FOREIGN KEY ("lifecycle_template_id")
          REFERENCES "lifecycle_template"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_lifecycle_template_version_published"
        ON "lifecycle_template_version" ("lifecycle_template_id")
        WHERE "status" = 'published'
    `);
    await queryRunner.query(`
      CREATE TABLE "lifecycle_template_stage" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lifecycle_template_version_id" character varying(26) NOT NULL,
        "stage_code" character varying(40) NOT NULL,
        "sequence" integer NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "default_weight_bps" integer NOT NULL,
        "completes_on_activation" boolean NOT NULL DEFAULT false,
        CONSTRAINT "pk_lifecycle_template_stage" PRIMARY KEY ("id"),
        CONSTRAINT "uq_lifecycle_template_stage_code"
          UNIQUE ("lifecycle_template_version_id", "stage_code"),
        CONSTRAINT "uq_lifecycle_template_stage_sequence"
          UNIQUE ("lifecycle_template_version_id", "sequence"),
        CONSTRAINT "ck_lifecycle_template_stage_code"
          CHECK ("stage_code" IN (${STAGE_CODES})),
        CONSTRAINT "ck_lifecycle_template_stage_weight"
          CHECK ("default_weight_bps" BETWEEN 0 AND 10000),
        CONSTRAINT "fk_lifecycle_template_stage_version"
          FOREIGN KEY ("lifecycle_template_version_id")
          REFERENCES "lifecycle_template_version"("id") ON DELETE RESTRICT
      )
    `);

    // Seed the system lifecycle as a draft, then publish it.
    await queryRunner.query(
      `INSERT INTO "lifecycle_template" ("id", "code", "name", "description")
       VALUES ($1, 'oil_and_gas_standard', 'Oil and gas contract lifecycle',
               'The nine stages of an oil and gas contract, from award to post-contract obligations.')`,
      [TEMPLATE_ID],
    );
    await queryRunner.query(
      `INSERT INTO "lifecycle_template_version"
         ("id", "lifecycle_template_id", "version_number", "status")
       VALUES ($1, $2, 1, 'draft')`,
      [VERSION_ID, TEMPLATE_ID],
    );
    for (const [index, [id, code, name, weight]] of SEED_STAGES.entries()) {
      await queryRunner.query(
        `INSERT INTO "lifecycle_template_stage"
           ("id", "lifecycle_template_version_id", "stage_code", "sequence",
            "name", "default_weight_bps", "completes_on_activation")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          VERSION_ID,
          code,
          index + 1,
          name,
          weight,
          code === 'contract_award',
        ],
      );
    }
    await queryRunner.query(
      `UPDATE "lifecycle_template_version"
          SET "status" = 'published', "published_at" = now()
        WHERE "id" = $1`,
      [VERSION_ID],
    );

    // A published or retired version's stages are fixed.
    await queryRunner.query(`
      CREATE FUNCTION "lifecycle_template_stage_immutable"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        version_status character varying(20);
      BEGIN
        SELECT "status" INTO version_status FROM "lifecycle_template_version"
         WHERE "id" = COALESCE(NEW."lifecycle_template_version_id",
                               OLD."lifecycle_template_version_id");
        IF version_status IS DISTINCT FROM 'draft' THEN
          RAISE EXCEPTION 'A published lifecycle template version can''t change.'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "lifecycle_template_stage_immutable"
        BEFORE INSERT OR UPDATE OR DELETE ON "lifecycle_template_stage"
        FOR EACH ROW EXECUTE FUNCTION "lifecycle_template_stage_immutable"()
    `);

    // --- Contracts ----------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "contract"
        ADD COLUMN "lifecycle_template_version_id" character varying(26),
        ADD COLUMN "lifecycle_initialised_at" TIMESTAMP WITH TIME ZONE,
        ADD CONSTRAINT "fk_contract_lifecycle_template_version"
          FOREIGN KEY ("lifecycle_template_version_id")
          REFERENCES "lifecycle_template_version"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "ck_contract_lifecycle_initialised"
          CHECK (("lifecycle_template_version_id" IS NULL)
                 = ("lifecycle_initialised_at" IS NULL))
    `);

    // --- Stages ---------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "contract_stage"
        ADD COLUMN "stage_code" character varying(40),
        ADD COLUMN "template_stage_id" character varying(26),
        ADD COLUMN "is_applicable" boolean NOT NULL DEFAULT true,
        ADD COLUMN "applicability_reason" text,
        ADD COLUMN "applicability_decided_by_id" character varying(26),
        ADD COLUMN "applicability_decided_at" TIMESTAMP WITH TIME ZONE,
        ADD CONSTRAINT "fk_contract_stage_template_stage"
          FOREIGN KEY ("template_stage_id")
          REFERENCES "lifecycle_template_stage"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "fk_contract_stage_applicability_decided_by"
          FOREIGN KEY ("applicability_decided_by_id")
          REFERENCES "company_user"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "ck_contract_stage_code"
          CHECK ("stage_code" IS NULL OR "stage_code" IN (${STAGE_CODES})),
        ADD CONSTRAINT "ck_contract_stage_not_applicable_reason"
          CHECK ("is_applicable" OR "applicability_reason" IS NOT NULL),
        ADD CONSTRAINT "ck_contract_stage_weight"
          CHECK ("weight_bps" BETWEEN 0 AND 10000)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_contract_stage_code"
        ON "contract_stage" ("contract_id", "stage_code")
        WHERE "stage_code" IS NOT NULL
    `);

    // --- Stage history ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "contract_stage_history" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_id" character varying(26) NOT NULL,
        "contract_stage_id" character varying(26) NOT NULL,
        "event_type" character varying(30) NOT NULL,
        "from_status" character varying(30),
        "to_status" character varying(30),
        "from_applicable" boolean,
        "to_applicable" boolean,
        "from_weight_bps" integer,
        "to_weight_bps" integer,
        "reason" text,
        "actor_company_user_id" character varying(26) NOT NULL,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "pk_contract_stage_history" PRIMARY KEY ("id"),
        CONSTRAINT "ck_contract_stage_history_event"
          CHECK ("event_type" IN (${HISTORY_EVENTS})),
        CONSTRAINT "fk_contract_stage_history_contract"
          FOREIGN KEY ("contract_id") REFERENCES "contract"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_contract_stage_history_stage"
          FOREIGN KEY ("contract_stage_id") REFERENCES "contract_stage"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_contract_stage_history_actor"
          FOREIGN KEY ("actor_company_user_id") REFERENCES "company_user"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_contract_stage_history_stage"
        ON "contract_stage_history" ("contract_id", "contract_stage_id", "occurred_at")
    `);
    await queryRunner.query(`
      CREATE FUNCTION "contract_stage_history_immutable"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Stage history can''t be changed.'
          USING ERRCODE = 'check_violation';
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "contract_stage_history_immutable"
        BEFORE UPDATE ON "contract_stage_history"
        FOR EACH ROW EXECUTE FUNCTION "contract_stage_history_immutable"()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL can't remove an enum value in place; refuse rather than
    // rewrite history if any contract or history row uses it.
    const [{ rows }] = (await queryRunner.query(`
      SELECT (
        (SELECT COUNT(*) FROM "contract" WHERE "status"::text = 'defects_liability')
        + (SELECT COUNT(*) FROM "contract_status_history"
            WHERE "from_status"::text = 'defects_liability'
               OR "to_status"::text = 'defects_liability')
      )::int AS rows
    `)) as Array<{ rows: number }>;
    if (Number(rows) > 0) {
      throw new Error(
        `Cannot remove the defects_liability status: ${rows} contract or ` +
          'history row(s) use it. Resolve them deliberately before rolling back.',
      );
    }

    await queryRunner.query(`DROP TABLE "contract_stage_history"`);
    await queryRunner.query(
      `DROP FUNCTION "contract_stage_history_immutable"()`,
    );
    await queryRunner.query(`DROP INDEX "uq_contract_stage_code"`);
    await queryRunner.query(`
      ALTER TABLE "contract_stage"
        DROP CONSTRAINT "ck_contract_stage_weight",
        DROP CONSTRAINT "ck_contract_stage_not_applicable_reason",
        DROP CONSTRAINT "ck_contract_stage_code",
        DROP CONSTRAINT "fk_contract_stage_applicability_decided_by",
        DROP CONSTRAINT "fk_contract_stage_template_stage",
        DROP COLUMN "applicability_decided_at",
        DROP COLUMN "applicability_decided_by_id",
        DROP COLUMN "applicability_reason",
        DROP COLUMN "is_applicable",
        DROP COLUMN "template_stage_id",
        DROP COLUMN "stage_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract"
        DROP CONSTRAINT "ck_contract_lifecycle_initialised",
        DROP CONSTRAINT "fk_contract_lifecycle_template_version",
        DROP COLUMN "lifecycle_initialised_at",
        DROP COLUMN "lifecycle_template_version_id"
    `);
    await queryRunner.query(`DROP TABLE "lifecycle_template_stage"`);
    await queryRunner.query(
      `DROP FUNCTION "lifecycle_template_stage_immutable"()`,
    );
    await queryRunner.query(`DROP TABLE "lifecycle_template_version"`);
    await queryRunner.query(`DROP TABLE "lifecycle_template"`);

    for (const [table, columns, type, labels] of [
      [
        'contract',
        ['status'],
        'contract_status_enum',
        "'draft', 'active', 'suspended', 'completed'",
      ],
      [
        'contract_status_history',
        ['from_status'],
        'contract_status_history_from_status_enum',
        "'draft', 'active', 'suspended', 'completed'",
      ],
      [
        'contract_status_history',
        ['to_status'],
        'contract_status_history_to_status_enum',
        "'draft', 'active', 'suspended', 'completed'",
      ],
    ] as const) {
      for (const column of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE text USING "${column}"::text`,
        );
      }
      await queryRunner.query(`DROP TYPE "public"."${type}"`);
      await queryRunner.query(
        `CREATE TYPE "public"."${type}" AS ENUM(${labels})`,
      );
      for (const column of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "public"."${type}" USING "${column}"::"public"."${type}"`,
        );
      }
    }
  }
}
