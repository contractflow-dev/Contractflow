import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentitySchemaBootstrap1749000000000 implements MigrationInterface {
  name = 'IdentitySchemaBootstrap1749000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const identityColumns: Record<string, string[]> = {
      app_user: [
        'id',
        'created_at',
        'updated_at',
        'email',
        'first_name',
        'last_name',
        'middle_name',
        'phone_number',
        'password_hash',
        'status',
        'is_platform_admin',
        'mfa_enabled',
        'timezone',
        'email_verified_at',
        'last_login_at',
      ],
      company: [
        'id',
        'created_at',
        'updated_at',
        'name',
        'legal_name',
        'registration_number',
        'tax_identification_number',
        'email',
        'phone_number',
        'website',
        'address_line1',
        'address_line2',
        'city',
        'state_region',
        'postal_code',
        'country_code',
        'default_currency_code',
        'status',
        'verified_at',
      ],
      company_user: [
        'id',
        'created_at',
        'updated_at',
        'company_id',
        'user_id',
        'company_role',
        'job_title',
        'status',
        'joined_at',
        'left_at',
      ],
      company_invitation: [
        'id',
        'created_at',
        'updated_at',
        'company_id',
        'invited_by_company_user_id',
        'email',
        'first_name',
        'last_name',
        'company_role',
        'token_hash',
        'status',
        'expires_at',
        'accepted_at',
        'revoked_at',
      ],
      user_session: [
        'id',
        'created_at',
        'updated_at',
        'user_id',
        'refresh_token_hash',
        'ip_address',
        'user_agent',
        'expires_at',
        'revoked_at',
      ],
    };
    const identityTables = Object.keys(identityColumns);
    const existingTables = await Promise.all(
      identityTables.map((table) => queryRunner.hasTable(table)),
    );

    if (existingTables.every(Boolean)) {
      for (const [tableName, expectedColumns] of Object.entries(
        identityColumns,
      )) {
        const table = await queryRunner.getTable(tableName);
        const actualColumns = new Set(table?.columns.map(({ name }) => name));
        const missingColumns = expectedColumns.filter(
          (column) => !actualColumns.has(column),
        );
        if (
          !table ||
          missingColumns.length > 0 ||
          !table.primaryColumns.some(
            ({ name, type, length }) =>
              name === 'id' &&
              ['varchar', 'character varying'].includes(type) &&
              length === '26',
          )
        ) {
          throw new Error(
            `Existing identity table "${tableName}" does not match the bootstrap schema; refusing to skip initialization.`,
          );
        }
      }

      const expectedForeignKeys = [
        ['company_user', 'company_id', 'company'],
        ['company_user', 'user_id', 'app_user'],
        ['company_invitation', 'company_id', 'company'],
        ['company_invitation', 'invited_by_company_user_id', 'company_user'],
        ['user_session', 'user_id', 'app_user'],
      ] as const;
      for (const [
        tableName,
        columnName,
        referencedTable,
      ] of expectedForeignKeys) {
        const table = await queryRunner.getTable(tableName);
        if (
          !table?.foreignKeys.some(
            (foreignKey) =>
              foreignKey.columnNames.includes(columnName) &&
              foreignKey.referencedTableName === referencedTable &&
              foreignKey.referencedColumnNames.includes('id'),
          )
        ) {
          throw new Error(
            `Existing identity table "${tableName}" is missing its "${columnName}" foreign key; refusing to skip initialization.`,
          );
        }
      }

      const expectedUniqueKeys = [
        ['app_user', ['email']],
        ['company_invitation', ['token_hash']],
        ['user_session', ['refresh_token_hash']],
      ] as const;
      for (const [tableName, columns] of expectedUniqueKeys) {
        const table = await queryRunner.getTable(tableName);
        const hasUniqueKey =
          table?.uniques.some(
            (unique) =>
              unique.columnNames.length === columns.length &&
              columns.every((column) => unique.columnNames.includes(column)),
          ) ||
          table?.indices.some(
            (index) =>
              index.isUnique &&
              index.columnNames.length === columns.length &&
              columns.every((column) => index.columnNames.includes(column)),
          );
        if (!hasUniqueKey) {
          throw new Error(
            `Existing identity table "${tableName}" is missing its unique key on (${columns.join(', ')}); refusing to skip initialization.`,
          );
        }
      }
      return;
    }
    if (existingTables.some(Boolean)) {
      throw new Error(
        'The identity schema is only partially present; refusing to create it over an unknown schema.',
      );
    }

    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS citext');
    await queryRunner.query(
      `CREATE TYPE "public"."app_user_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(`
      CREATE TYPE "public"."company_user_company_role_enum" AS ENUM(
        'Contractor Project Lead',
        'Contractor Site Supervisor',
        'Client Project Manager',
        'Client Site Engineer',
        'HSE Officer',
        'HSE Manager',
        'Finance Officer',
        'Finance Director',
        'Company Administrator'
      )
    `);
    await queryRunner.query(
      `CREATE TYPE "public"."company_user_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(`
      CREATE TYPE "public"."company_invitation_company_role_enum" AS ENUM(
        'Contractor Project Lead',
        'Contractor Site Supervisor',
        'Client Project Manager',
        'Client Site Engineer',
        'HSE Officer',
        'HSE Manager',
        'Finance Officer',
        'Finance Director'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."company_invitation_status_enum" AS ENUM(
        'pending',
        'accepted',
        'declined',
        'expired',
        'revoked'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "company" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        "legal_name" character varying(255) NOT NULL,
        "registration_number" character varying(64) NOT NULL,
        "tax_identification_number" character varying(64) NOT NULL,
        "email" citext NOT NULL,
        "phone_number" character varying(20) NOT NULL,
        "website" character varying(255) NOT NULL,
        "address_line1" character varying(255) NOT NULL,
        "address_line2" character varying(255) NOT NULL,
        "city" character varying(100) NOT NULL,
        "state_region" character varying(100) NOT NULL,
        "postal_code" character varying(20) NOT NULL,
        "country_code" character(2) NOT NULL,
        "default_currency_code" character(3) NOT NULL,
        "status" "public"."company_status_enum" NOT NULL,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_company" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "app_user" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "email" citext NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "middle_name" character varying(100) NOT NULL,
        "phone_number" character varying(20) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "status" "public"."app_user_status_enum" NOT NULL DEFAULT 'active',
        "is_platform_admin" boolean NOT NULL,
        "mfa_enabled" boolean NOT NULL,
        "timezone" character varying(64) NOT NULL,
        "email_verified_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "last_login_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_app_user" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_user_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "company_user" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "company_id" character varying(26) NOT NULL,
        "user_id" character varying(26) NOT NULL,
        "company_role" "public"."company_user_company_role_enum" NOT NULL,
        "job_title" character varying(150) NOT NULL,
        "status" "public"."company_user_status_enum" NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "left_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_company_user" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_user_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_company_user_app_user"
          FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "company_invitation" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "company_id" character varying(26) NOT NULL,
        "invited_by_company_user_id" character varying(26) NOT NULL,
        "email" citext NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "company_role" "public"."company_invitation_company_role_enum" NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "status" "public"."company_invitation_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_company_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_invitation_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_company_invitation_company"
          FOREIGN KEY ("company_id") REFERENCES "company"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_company_invitation_inviter"
          FOREIGN KEY ("invited_by_company_user_id") REFERENCES "company_user"("id")
          ON DELETE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_session" (
        "id" character varying(26) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" character varying(26) NOT NULL,
        "refresh_token_hash" character varying(255) NOT NULL,
        "ip_address" inet NOT NULL,
        "user_agent" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_user_session" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_session_refresh_token_hash" UNIQUE ("refresh_token_hash"),
        CONSTRAINT "FK_user_session_app_user"
          FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
          ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const identityTables = [
      'app_user',
      'company',
      'company_user',
      'company_invitation',
      'user_session',
    ];
    const existingTables = await Promise.all(
      identityTables.map((table) => queryRunner.hasTable(table)),
    );
    if (existingTables.some(Boolean) && !existingTables.every(Boolean)) {
      throw new Error(
        'The identity schema is only partially present; refusing to remove an unknown schema.',
      );
    }

    if (!existingTables.some(Boolean)) {
      return;
    }

    const tablesWithData: string[] = [];
    for (const table of identityTables) {
      const rows = await queryRunner.query(
        `SELECT EXISTS (SELECT 1 FROM "${table}") AS "hasRows"`,
      );
      if (rows[0].hasRows) {
        tablesWithData.push(table);
      }
    }
    if (tablesWithData.length > 0) {
      throw new Error(
        `Cannot roll back identity schema while these tables contain data: ${tablesWithData.join(', ')}.`,
      );
    }

    await queryRunner.query('DROP TABLE "user_session"');
    await queryRunner.query('DROP TABLE "company_invitation"');
    await queryRunner.query('DROP TABLE "company_user"');
    await queryRunner.query('DROP TABLE "company"');
    await queryRunner.query('DROP TABLE "app_user"');
    await queryRunner.query(
      'DROP TYPE "public"."company_invitation_status_enum"',
    );
    await queryRunner.query(
      'DROP TYPE "public"."company_invitation_company_role_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."company_user_status_enum"');
    await queryRunner.query(
      'DROP TYPE "public"."company_user_company_role_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."company_status_enum"');
    await queryRunner.query('DROP TYPE "public"."app_user_status_enum"');
  }
}
