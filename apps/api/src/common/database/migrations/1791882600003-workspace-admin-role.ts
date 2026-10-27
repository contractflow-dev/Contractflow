import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceAdminRole1791882600003 implements MigrationInterface {
  name = 'WorkspaceAdminRole1791882600003';

  async up(queryRunner: QueryRunner): Promise<void> {
    const [inconsistentAssignments] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "contract_role_assignment" assignment
      LEFT JOIN "contract_party" party
        ON party."id" = assignment."contract_party_id"
       AND party."company_id" = assignment."company_id"
      LEFT JOIN "company_user" member
        ON member."id" = assignment."company_user_id"
       AND member."company_id" = assignment."company_id"
      WHERE party."id" IS NULL OR member."id" IS NULL
    `);
    if (Number(inconsistentAssignments.count) > 0) {
      throw new Error(
        'Cannot enforce assignment company scope while cross-company assignments exist.',
      );
    }

    for (const [tableName, indexName] of [
      ['contract_party', 'uq_contract_party_id_company'],
      ['company_user', 'uq_company_user_id_company'],
    ] as const) {
      const table = await queryRunner.getTable(tableName);
      const existing = table?.indices.find(
        (index) => index.name === indexName,
      );
      if (
        existing &&
        (!existing.isUnique || existing.columnNames.join(',') !== 'id,company_id')
      ) {
        throw new Error(`Existing index "${indexName}" is incompatible.`);
      }
      if (
        !existing &&
        !table?.indices.some(
          (index) =>
            index.isUnique && index.columnNames.join(',') === 'id,company_id',
        )
      ) {
        await queryRunner.query(`
          CREATE UNIQUE INDEX "${indexName}"
          ON "${tableName}" ("id", "company_id")
        `);
      }
    }

    const expectedForeignKeys = [
      {
        name: 'fk_role_assignment_party_company',
        columns: ['contract_party_id', 'company_id'],
        referencedTable: 'contract_party',
      },
      {
        name: 'fk_role_assignment_member_company',
        columns: ['company_user_id', 'company_id'],
        referencedTable: 'company_user',
      },
    ] as const;
    for (const expected of expectedForeignKeys) {
      const table = await queryRunner.getTable('contract_role_assignment');
      if (!table) {
        throw new Error('Contract role assignment table is missing.');
      }
      const matches = (foreignKey: (typeof table.foreignKeys)[number]) =>
        foreignKey.columnNames.join(',') === expected.columns.join(',') &&
        foreignKey.referencedTableName === expected.referencedTable &&
        foreignKey.referencedColumnNames.join(',') === 'id,company_id' &&
        (foreignKey.onDelete ?? '').toUpperCase() === 'CASCADE';
      const namedKey = table.foreignKeys.find(
        (foreignKey) => foreignKey.name === expected.name,
      );
      if (namedKey && !matches(namedKey)) {
        throw new Error(
          `Existing contract role assignment foreign key "${expected.name}" is incompatible.`,
        );
      }
      if (!namedKey && !table.foreignKeys.some(matches)) {
        await queryRunner.query(`
          ALTER TABLE "contract_role_assignment"
          ADD CONSTRAINT "${expected.name}"
          FOREIGN KEY ("${expected.columns[0]}", "company_id")
          REFERENCES "${expected.referencedTable}" ("id", "company_id")
          ON DELETE CASCADE
        `);
      }
    }

    await queryRunner.query(`
      ALTER TABLE "contract_role_assignment"
      ADD COLUMN IF NOT EXISTS "is_workspace_admin" boolean NOT NULL DEFAULT false
    `);
    const assignmentTable = await queryRunner.getTable(
      'contract_role_assignment',
    );
    const workspaceAdminColumn = assignmentTable?.columns.find(
      (column) => column.name === 'is_workspace_admin',
    );
    if (
      !workspaceAdminColumn ||
      workspaceAdminColumn.type !== 'boolean' ||
      workspaceAdminColumn.isNullable ||
      !['false', 'false::boolean'].includes(
        (workspaceAdminColumn.default ?? '').toLowerCase(),
      )
    ) {
      throw new Error(
        'Existing workspace-admin column does not match the migration schema.',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [workspaceAdmins] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "contract_role_assignment"
      WHERE "is_workspace_admin" = true
    `);
    if (Number(workspaceAdmins.count) > 0) {
      throw new Error(
        'Cannot remove workspace-admin privileges while any are assigned.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "contract_role_assignment"
      DROP CONSTRAINT "fk_role_assignment_member_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_role_assignment"
      DROP CONSTRAINT "fk_role_assignment_party_company"
    `);
    await queryRunner.query('DROP INDEX "uq_company_user_id_company"');
    await queryRunner.query('DROP INDEX "uq_contract_party_id_company"');
    await queryRunner.query(`
      ALTER TABLE "contract_role_assignment"
      DROP COLUMN "is_workspace_admin"
    `);
  }
}
