import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractRoleInvitations1791882600004 implements MigrationInterface {
  name = 'ContractRoleInvitations1791882600004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_role_invitation" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "contract_party_id" character varying(26) NOT NULL,
        "company_id" character varying(26) NOT NULL,
        "invited_by_id" character varying(26) NOT NULL,
        "email" character varying(320) NOT NULL,
        "contract_role" "public"."contract_role_assignment_contract_role_enum" NOT NULL,
        "workspace" character varying(20) NOT NULL,
        "is_workspace_admin" boolean NOT NULL DEFAULT false,
        "token_hash" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_contract_role_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "ck_contract_role_invitation_workspace"
          CHECK ("workspace" IN ('project', 'hse', 'finance')),
        CONSTRAINT "ck_contract_role_invitation_status"
          CHECK ("status" IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')),
        CONSTRAINT "fk_contract_role_invitation_party"
          FOREIGN KEY ("contract_party_id")
          REFERENCES "contract_party"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_role_invitation_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_role_invitation_inviter"
          FOREIGN KEY ("invited_by_id") REFERENCES "company_user"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_role_invitation_party_company"
          FOREIGN KEY ("contract_party_id", "company_id")
          REFERENCES "contract_party"("id", "company_id") ON DELETE CASCADE,
        CONSTRAINT "fk_contract_role_invitation_inviter_company"
          FOREIGN KEY ("invited_by_id", "company_id")
          REFERENCES "company_user"("id", "company_id") ON DELETE CASCADE
      )
    `);

    const invitationTable = await queryRunner.getTable(
      'contract_role_invitation',
    );
    if (!invitationTable) {
      throw new Error('Contract role invitation table was not created.');
    }
    const [contractRoleColumn] = await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'contract_role_invitation'
        AND column_name = 'contract_role'
    `);
    if (
      contractRoleColumn?.udt_name ===
      'contract_role_invitation_contract_role_enum'
    ) {
      const [matchingEnums] = await queryRunner.query(`
        SELECT
          ARRAY(
            SELECT enumlabel::text
            FROM pg_enum
            WHERE enumtypid = '"public"."contract_role_invitation_contract_role_enum"'::regtype
            ORDER BY enumsortorder
          ) =
          ARRAY(
            SELECT enumlabel::text
            FROM pg_enum
            WHERE enumtypid = '"public"."contract_role_assignment_contract_role_enum"'::regtype
            ORDER BY enumsortorder
          ) AS "match"
      `);
      if (!matchingEnums.match) {
        throw new Error(
          'Cannot reconcile the contract role invitation enum because its labels differ from the shared contract-role enum.',
        );
      }
      await queryRunner.query(`
        ALTER TABLE "contract_role_invitation"
        ALTER COLUMN "contract_role"
        TYPE "public"."contract_role_assignment_contract_role_enum"
        USING "contract_role"::text::"public"."contract_role_assignment_contract_role_enum"
      `);
    } else if (
      contractRoleColumn?.udt_name !==
      'contract_role_assignment_contract_role_enum'
    ) {
      throw new Error(
        'Existing contract role invitation role type is incompatible with the migration schema.',
      );
    }

    const reconciledInvitationTable = await queryRunner.getTable(
      'contract_role_invitation',
    );
    if (!reconciledInvitationTable) {
      throw new Error('Contract role invitation table is missing.');
    }
    const expectedColumns = [
      ['id', 'character varying', '26', false],
      ['created_at', 'timestamp with time zone', '', false],
      ['updated_at', 'timestamp with time zone', '', false],
      ['contract_party_id', 'character varying', '26', false],
      ['company_id', 'character varying', '26', false],
      ['invited_by_id', 'character varying', '26', false],
      ['email', 'character varying', '320', false],
      [
        'contract_role',
        'enum',
        '',
        false,
      ],
      ['workspace', 'character varying', '20', false],
      ['is_workspace_admin', 'boolean', '', false],
      ['token_hash', 'character varying', '64', false],
      ['status', 'character varying', '20', false],
      ['expires_at', 'timestamp with time zone', '', false],
      ['responded_at', 'timestamp with time zone', '', true],
      ['revoked_at', 'timestamp with time zone', '', true],
    ] as const;
    for (const [name, type, length, nullable] of expectedColumns) {
      const column = reconciledInvitationTable.columns.find(
        (candidate) => candidate.name === name,
      );
      if (
        !column ||
        column.type.toLowerCase() !== type ||
        (column.length ?? '') !== length ||
        column.isNullable !== nullable
      ) {
        throw new Error(
          `Existing contract role invitation column "${name}" does not match the migration schema.`,
        );
      }
    }
    const roleColumn = reconciledInvitationTable.columns.find(
      (candidate) => candidate.name === 'contract_role',
    );
    if (
      !roleColumn?.enum ||
      roleColumn.enum.join('\u0000') !==
        [
          'Contractor Project Lead',
          'Contractor Site Supervisor',
          'Client Project Manager',
          'Client Site Engineer',
          'HSE Officer',
          'HSE Manager',
          'Finance Officer',
          'Finance Director',
        ].join('\u0000')
    ) {
      throw new Error(
        'Existing contract role invitation enum labels do not match the migration schema.',
      );
    }
    if (
      reconciledInvitationTable.primaryColumns.length !== 1 ||
      reconciledInvitationTable.primaryColumns[0]?.name !== 'id'
    ) {
      throw new Error(
        'Existing contract role invitation primary key does not match the migration schema.',
      );
    }

    const expectedChecks = [
      {
        name: 'ck_contract_role_invitation_workspace',
        expression: `"workspace" IN ('project', 'hse', 'finance')`,
      },
      {
        name: 'ck_contract_role_invitation_status',
        expression:
          `"status" IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')`,
      },
    ] as const;
    for (const expected of expectedChecks) {
      const namedCheck = reconciledInvitationTable.checks.find(
        (check) => check.name === expected.name,
      );
      if (namedCheck) {
        const normalize = (value: string) =>
          value.toLowerCase().replace(/["'()\s]/g, '');
        if (
          normalize(namedCheck.expression ?? '') !==
          normalize(expected.expression)
        ) {
          throw new Error(
            `Existing contract role invitation check "${expected.name}" is incompatible.`,
          );
        }
      } else {
        const [nameOccupied] = await queryRunner.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"contract_role_invitation"'::regclass
              AND conname = $1
          ) AS present`,
          [expected.name],
        );
        if (nameOccupied.present) {
          throw new Error(
            `Constraint name "${expected.name}" is occupied by an incompatible object.`,
          );
        }
        await queryRunner.query(`
          ALTER TABLE "contract_role_invitation"
          ADD CONSTRAINT "${expected.name}" CHECK (${expected.expression})
        `);
      }
    }

    const expectedForeignKeys = [
      {
        name: 'fk_contract_role_invitation_party',
        columns: ['contract_party_id'],
        referencedTable: 'contract_party',
        referencedColumns: ['id'],
      },
      {
        name: 'fk_contract_role_invitation_company',
        columns: ['company_id'],
        referencedTable: 'company',
        referencedColumns: ['id'],
      },
      {
        name: 'fk_contract_role_invitation_inviter',
        columns: ['invited_by_id'],
        referencedTable: 'company_user',
        referencedColumns: ['id'],
      },
      {
        name: 'fk_contract_role_invitation_party_company',
        columns: ['contract_party_id', 'company_id'],
        referencedTable: 'contract_party',
        referencedColumns: ['id', 'company_id'],
      },
      {
        name: 'fk_contract_role_invitation_inviter_company',
        columns: ['invited_by_id', 'company_id'],
        referencedTable: 'company_user',
        referencedColumns: ['id', 'company_id'],
      },
    ] as const;
    for (const expected of expectedForeignKeys) {
      const table = await queryRunner.getTable('contract_role_invitation');
      if (!table) {
        throw new Error('Contract role invitation table is missing.');
      }
      const matches = (foreignKey: (typeof table.foreignKeys)[number]) =>
        foreignKey.columnNames.join(',') === expected.columns.join(',') &&
        foreignKey.referencedTableName === expected.referencedTable &&
        foreignKey.referencedColumnNames.join(',') ===
          expected.referencedColumns.join(',') &&
        (foreignKey.onDelete ?? '').toUpperCase() === 'CASCADE';
      const namedKey = table.foreignKeys.find(
        (foreignKey) => foreignKey.name === expected.name,
      );
      if (namedKey && !matches(namedKey)) {
        throw new Error(
          `Existing contract role invitation foreign key "${expected.name}" is incompatible.`,
        );
      }
      if (!namedKey && !table.foreignKeys.some(matches)) {
        await queryRunner.query(`
          ALTER TABLE "contract_role_invitation"
          ADD CONSTRAINT "${expected.name}"
          FOREIGN KEY (${expected.columns.map((column) => `"${column}"`).join(', ')})
          REFERENCES "${expected.referencedTable}"
            (${expected.referencedColumns.map((column) => `"${column}"`).join(', ')})
          ON DELETE CASCADE
        `);
      }
    }

    const ensureIndex = async ({
      name,
      columns,
      unique,
      predicate,
    }: {
      name: string;
      columns: string[];
      unique: boolean;
      predicate: string | null;
    }) => {
      const indexes = (await queryRunner.query(
        `
          SELECT
            index_row.relname AS name,
            index_data.indisunique AS unique,
            index_data.indisvalid AS valid,
            index_data.indisready AS ready,
            ARRAY(
              SELECT attribute_row.attname::text
              FROM unnest(index_data.indkey) WITH ORDINALITY AS key_row(attnum, ordinality)
              JOIN pg_attribute attribute_row
                ON attribute_row.attrelid = table_row.oid
               AND attribute_row.attnum = key_row.attnum
              WHERE key_row.ordinality <= index_data.indnkeyatts
              ORDER BY key_row.ordinality
            ) AS columns,
            pg_get_expr(index_data.indpred, index_data.indrelid) AS predicate
          FROM pg_index index_data
          JOIN pg_class index_row ON index_row.oid = index_data.indexrelid
          JOIN pg_class table_row ON table_row.oid = index_data.indrelid
          JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = current_schema()
            AND table_row.relname = 'contract_role_invitation'
        `,
      )) as Array<{
        name: string;
        unique: boolean;
        valid: boolean;
        ready: boolean;
        columns: string[];
        predicate: string | null;
      }>;
      const normalizePredicate = (value: string | null) =>
        (value ?? '')
          .toLowerCase()
          .replace(/::text/g, '')
          .replace(/["'()\s]/g, '');
      const equivalent = (index: (typeof indexes)[number]) =>
        index.unique === unique &&
        index.valid &&
        index.ready &&
        index.columns.join(',') === columns.join(',') &&
        normalizePredicate(index.predicate) ===
          normalizePredicate(predicate);
      const namedIndex = indexes.find((index) => index.name === name);
      if (namedIndex && !equivalent(namedIndex)) {
        throw new Error(
          `Existing contract role invitation index "${name}" is incompatible.`,
        );
      }
      if (namedIndex || indexes.some(equivalent)) return;

      const [nameOccupied] = await queryRunner.query(
        `SELECT to_regclass(format('%I.%I', current_schema(), $1)) IS NOT NULL AS present`,
        [name],
      );
      if (nameOccupied.present) {
        throw new Error(
          `Contract role invitation index name "${name}" is occupied by another object.`,
        );
      }
      await queryRunner.query(`
        CREATE ${unique ? 'UNIQUE ' : ''}INDEX "${name}"
        ON "contract_role_invitation" (${columns.map((column) => `"${column}"`).join(', ')})
        ${predicate ? `WHERE ${predicate}` : ''}
      `);
    };

    await ensureIndex({
      name: 'uq_contract_role_invitation_token',
      columns: ['token_hash'],
      unique: true,
      predicate: null,
    });
    await ensureIndex({
      name: 'uq_contract_role_invitation_pending',
      columns: ['contract_party_id', 'email', 'contract_role'],
      unique: true,
      predicate: `"status" = 'pending'`,
    });
    await ensureIndex({
      name: 'ix_contract_role_invitation_party_status_expiry',
      columns: ['contract_party_id', 'status', 'expires_at'],
      unique: false,
      predicate: null,
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [existingInvitations] = await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "contract_role_invitation"
    `);
    if (Number(existingInvitations.count) > 0) {
      throw new Error(
        'Cannot remove the contract role invitation table while invitation records exist.',
      );
    }

    await queryRunner.query('DROP TABLE "contract_role_invitation"');
  }
}
