import type { MigrationInterface, QueryRunner } from 'typeorm';

const MEMBER_TYPE = 'company_user_company_role_enum';
const INVITATION_TYPE = 'company_invitation_company_role_enum';
const BACKUP_TABLE = 'migration_company_role_backup';

const OLD_CONTRACT_LABELS = [
  'Contractor Project Lead',
  'Contractor Site Supervisor',
  'Client Project Manager',
  'Client Site Engineer',
  'HSE Officer',
  'HSE Manager',
  'Finance Officer',
  'Finance Director',
];
const OLD_MEMBER_LABELS = [...OLD_CONTRACT_LABELS, 'Company Administrator'];
const NEW_LABELS = ['Company Administrator', 'Member'];

function enumList(labels: string[]): string {
  return labels.map((label) => `'${label}'`).join(', ');
}

/**
 * Company roles describe company membership only: Company Administrator or
 * Member. Contract roles (Project Lead, HSE Officer and so on) used to be
 * stored here too; they are assigned per contract and never came from the
 * company role, so every non-administrator becomes a Member and nothing
 * anyone can access changes.
 *
 * The old labels are copied to a backup table first, so `down` can put back
 * exactly what was there. `down` refuses rather than guess when a row has no
 * old label to return to.
 */
export class CompanyMembershipRoles1793600000000 implements MigrationInterface {
  name = 'CompanyMembershipRoles1793600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${BACKUP_TABLE}" (
        "table_name" character varying(32) NOT NULL,
        "row_id" character varying(26) NOT NULL,
        "company_role" text NOT NULL,
        CONSTRAINT "pk_${BACKUP_TABLE}" PRIMARY KEY ("table_name", "row_id")
      )
    `);
    for (const table of ['company_user', 'company_invitation']) {
      await queryRunner.query(`
        INSERT INTO "${BACKUP_TABLE}" ("table_name", "row_id", "company_role")
        SELECT '${table}', "id", "company_role"::text
          FROM "${table}"
         WHERE "company_role"::text <> 'Company Administrator'
        ON CONFLICT ("table_name", "row_id")
          DO UPDATE SET "company_role" = EXCLUDED."company_role"
      `);
    }

    await this.replaceType(
      queryRunner,
      'company_user',
      MEMBER_TYPE,
      NEW_LABELS,
    );
    await this.replaceType(
      queryRunner,
      'company_invitation',
      INVITATION_TYPE,
      NEW_LABELS,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A Member with no old label (someone who joined or was invited after
    // this migration) has nothing to return to. Old invitations could not
    // invite an administrator at all.
    const [blocked] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "company_user" cu
          WHERE cu."company_role"::text = 'Member'
            AND NOT EXISTS (
              SELECT 1 FROM "${BACKUP_TABLE}" b
               WHERE b."table_name" = 'company_user' AND b."row_id" = cu."id")
        ) AS members,
        (SELECT COUNT(*)::int FROM "company_invitation" ci
          WHERE ci."company_role"::text = 'Company Administrator'
             OR (ci."company_role"::text = 'Member' AND NOT EXISTS (
               SELECT 1 FROM "${BACKUP_TABLE}" b
                WHERE b."table_name" = 'company_invitation'
                  AND b."row_id" = ci."id"))
        ) AS invitations
    `);
    const members = Number(blocked.members);
    const invitations = Number(blocked.invitations);
    if (members > 0 || invitations > 0) {
      throw new Error(
        `Cannot restore the old company roles: ${members} member(s) and ` +
          `${invitations} invitation(s) have no earlier role to return to. ` +
          'Give them one deliberately before rolling back.',
      );
    }

    for (const table of ['company_user', 'company_invitation']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" ALTER COLUMN "company_role" TYPE text
          USING "company_role"::text
      `);
      // Only rows still holding Member go back; anyone promoted to
      // administrator since stays an administrator.
      await queryRunner.query(`
        UPDATE "${table}" t SET "company_role" = b."company_role"
          FROM "${BACKUP_TABLE}" b
         WHERE b."table_name" = '${table}' AND b."row_id" = t."id"
           AND t."company_role" = 'Member'
      `);
    }
    await this.recreateType(
      queryRunner,
      'company_user',
      MEMBER_TYPE,
      OLD_MEMBER_LABELS,
    );
    await this.recreateType(
      queryRunner,
      'company_invitation',
      INVITATION_TYPE,
      OLD_CONTRACT_LABELS,
    );
    await queryRunner.query(`DROP TABLE "${BACKUP_TABLE}"`);
  }

  /** Swaps the column to a new enum, holding the values as text meanwhile. */
  private async replaceType(
    queryRunner: QueryRunner,
    table: string,
    typeName: string,
    labels: string[],
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${table}" ALTER COLUMN "company_role" TYPE text
        USING "company_role"::text
    `);
    await queryRunner.query(`
      UPDATE "${table}" SET "company_role" = 'Member'
       WHERE "company_role" <> 'Company Administrator'
    `);
    await this.recreateType(queryRunner, table, typeName, labels);
  }

  /** Drops the enum and recreates it with `labels` for a text column. */
  private async recreateType(
    queryRunner: QueryRunner,
    table: string,
    typeName: string,
    labels: string[],
  ): Promise<void> {
    await queryRunner.query(`DROP TYPE "public"."${typeName}"`);
    await queryRunner.query(
      `CREATE TYPE "public"."${typeName}" AS ENUM(${enumList(labels)})`,
    );
    await queryRunner.query(`
      ALTER TABLE "${table}" ALTER COLUMN "company_role"
        TYPE "public"."${typeName}" USING "company_role"::"public"."${typeName}"
    `);
  }
}
