import type { MigrationInterface, QueryRunner } from 'typeorm';

const PARENT_FK = 'FK_f47cfaeabefd9d42a9aae56a488';
const NOT_OWN_PARENT = 'ck_contract_not_own_parent';
const RULES_FUNCTION = 'contract_parent_rules';
const RULES_TRIGGER = 'contract_parent_rules';

/**
 * A subcontract belongs to one main contract (`contract.parent_contract_id`),
 * and a main contract may have many subcontracts. The database now keeps the
 * relationship sound on its own:
 *
 * - A contract can't be its own parent (CHECK).
 * - The parent must be a main contract, so the hierarchy is one level deep
 *   and can never form a cycle (trigger).
 * - The parent is fixed once the contract exists (trigger). Contracts are
 *   created with it; the application refuses a change, and so does this.
 * - A parent with subcontracts can't be deleted from under them: ON DELETE
 *   RESTRICT replaces CASCADE. Contracts are archived (`deleted_at`), never
 *   deleted, so the relationship and both histories survive archiving.
 *
 * Who may create a subcontract (the awarded party on the main contract, the
 * parent draft or active and not archived) is checked by
 * ContractLifecycleService, which knows the caller.
 *
 * The migration refuses, and reports how many, if any contract is its own
 * parent or has a parent that is itself a subcontract.
 */
export class SubcontractParentRules1794000000002 implements MigrationInterface {
  name = 'SubcontractParentRules1794000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [found] = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "contract"
          WHERE "parent_contract_id" = "id") AS own_parent,
        (SELECT COUNT(*)::int FROM "contract" child
           JOIN "contract" parent ON parent."id" = child."parent_contract_id"
          WHERE parent."parent_contract_id" IS NOT NULL) AS nested
    `)) as Array<{ own_parent: number; nested: number }>;
    const ownParent = Number(found.own_parent);
    const nested = Number(found.nested);
    if (ownParent > 0 || nested > 0) {
      throw new Error(
        `Cannot enforce the subcontract rules: ${ownParent} contract(s) are ` +
          `their own parent and ${nested} have a parent that is itself a ` +
          'subcontract. Resolve them deliberately before migrating.',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "contract" DROP CONSTRAINT "${PARENT_FK}"`,
    );
    await queryRunner.query(`
      ALTER TABLE "contract" ADD CONSTRAINT "${PARENT_FK}"
        FOREIGN KEY ("parent_contract_id") REFERENCES "contract"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "contract" ADD CONSTRAINT "${NOT_OWN_PARENT}"
        CHECK ("parent_contract_id" IS NULL OR "parent_contract_id" <> "id")
    `);
    await queryRunner.query(`
      CREATE FUNCTION "${RULES_FUNCTION}"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'UPDATE'
           AND NEW."parent_contract_id" IS DISTINCT FROM OLD."parent_contract_id" THEN
          RAISE EXCEPTION 'A contract''s parent contract cannot be changed.'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW."parent_contract_id" IS NOT NULL AND EXISTS (
          SELECT 1 FROM "contract"
           WHERE "id" = NEW."parent_contract_id"
             AND "parent_contract_id" IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'A subcontract''s parent must be a main contract.'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "${RULES_TRIGGER}"
        BEFORE INSERT OR UPDATE OF "parent_contract_id" ON "contract"
        FOR EACH ROW EXECUTE FUNCTION "${RULES_FUNCTION}"()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "${RULES_TRIGGER}" ON "contract"`);
    await queryRunner.query(`DROP FUNCTION "${RULES_FUNCTION}"()`);
    await queryRunner.query(
      `ALTER TABLE "contract" DROP CONSTRAINT "${NOT_OWN_PARENT}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contract" DROP CONSTRAINT "${PARENT_FK}"`,
    );
    await queryRunner.query(`
      ALTER TABLE "contract" ADD CONSTRAINT "${PARENT_FK}"
        FOREIGN KEY ("parent_contract_id") REFERENCES "contract"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}
