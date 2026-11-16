import type { EntityManager } from 'typeorm';
import type {
  ContractRole,
  EContractStatus,
  EPartyType,
} from '@contractflow/contracts-schema';
import type {
  ICompanyDepartmentPersistence,
  IDepartmentContractRecord,
  IDepartmentMemberRecord,
} from '../interfaces/company-department-persistence.interface';
import type { ICompanyOversightScope } from '../services/contract-access.service';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

interface DepartmentRow {
  id: string;
  reference_number: string;
  title: string;
  status: EContractStatus;
  archived: boolean;
  updated_at: Date | string;
  party_type: EPartyType;
  owner_company_id: string | null;
  owner_company_name: string | null;
  last_status_change_at: Date | string | null;
  suspended_by_company_id: string | null;
  suspended_by_company_name: string | null;
  parties: Array<{
    companyId: string;
    companyName: string;
    partyType: EPartyType;
    signedAt: string | null;
  }>;
  pending_party_invitations: Array<{ companyId: string; companyName: string }>;
  members: IDepartmentMemberRecord[];
  pending_role_invitations: string | number;
  requester_has_role: boolean;
}

/**
 * The department pages' one query. `$1` is always the overseeing company:
 * contracts come only through its own party, and people, role invitations
 * and party invitations only from that company. Other parties appear only as
 * the parties view shows them (name, type, signing date).
 */
const DEPARTMENT_CONTRACTS_SQL = `
  WITH mine AS (
    SELECT c.id, c.reference_number, c.title, c.status, c.deleted_at,
           c.updated_at, c.created_by_company_id,
           p.id AS party_id, p.party_type
      FROM contract c
      JOIN contract_party p
        ON p.contract_id = c.id AND p.company_id = $1
      JOIN contract_workspace cw
        ON cw.contract_id = c.id AND cw.workspace = $2
     WHERE c.deleted_at IS NULL
        OR ($4::boolean AND c.created_by_company_id = $1)
  )
  SELECT m.id, m.reference_number, m.title, m.status,
         (m.deleted_at IS NOT NULL) AS archived,
         m.updated_at, m.party_type,
         m.created_by_company_id AS owner_company_id,
         owner.name AS owner_company_name,
         (SELECT MAX(h.changed_at) FROM contract_status_history h
           WHERE h.contract_id = m.id) AS last_status_change_at,
         suspender.company_id AS suspended_by_company_id,
         suspender.name AS suspended_by_company_name,
         (SELECT COALESCE(json_agg(json_build_object(
                   'companyId', p2.company_id, 'companyName', co.name,
                   'partyType', p2.party_type, 'signedAt', p2.signed_at)
                 ORDER BY co.name), '[]'::json)
            FROM contract_party p2
            JOIN company co ON co.id = p2.company_id
           WHERE p2.contract_id = m.id) AS parties,
         (SELECT COALESCE(json_agg(json_build_object(
                   'companyId', i.target_company_id, 'companyName', tc.name)
                 ORDER BY tc.name), '[]'::json)
            FROM contract_party_invitation i
            JOIN company tc ON tc.id = i.target_company_id
           WHERE i.source_contract_party_id = m.party_id
             AND i.source_company_id = $1
             AND i.status = 'pending'
             AND i.expires_at > $5) AS pending_party_invitations,
         (SELECT COALESCE(json_agg(json_build_object(
                   'companyUserId', x.company_user_id,
                   'firstName', x.first_name, 'lastName', x.last_name,
                   'isWorkspaceAdmin', x.is_admin)), '[]'::json)
            FROM (SELECT a.company_user_id, u.first_name, u.last_name,
                         bool_or(a.is_workspace_admin) AS is_admin
                    FROM contract_role_assignment a
                    JOIN company_user cu
                      ON cu.id = a.company_user_id AND cu.company_id = $1
                    JOIN app_user u ON u.id = cu.user_id
                   WHERE a.contract_party_id = m.party_id
                     AND a.company_id = $1
                     AND a.revoked_at IS NULL
                     AND a.contract_role::text = ANY($3::text[])
                   GROUP BY a.company_user_id, u.first_name, u.last_name) x
         ) AS members,
         (SELECT COUNT(*) FROM contract_role_invitation ri
           WHERE ri.contract_party_id = m.party_id
             AND ri.company_id = $1
             AND ri.workspace = $2
             AND ri.status = 'pending'
             AND ri.expires_at > $5) AS pending_role_invitations,
         EXISTS (SELECT 1 FROM contract_role_assignment a
                  WHERE a.contract_party_id = m.party_id
                    AND a.company_id = $1
                    AND a.company_user_id = $6
                    AND a.revoked_at IS NULL
                    AND a.contract_role::text = ANY($3::text[])
         ) AS requester_has_role
    FROM mine m
    LEFT JOIN company owner ON owner.id = m.created_by_company_id
    LEFT JOIN LATERAL (
      SELECT cu.company_id, co.name
        FROM contract_status_history h
        JOIN company_user cu ON cu.id = h.changed_by_id
        JOIN company co ON co.id = cu.company_id
       WHERE h.contract_id = m.id AND h.to_status = 'suspended'
       ORDER BY h.changed_at DESC
       LIMIT 1
    ) suspender ON m.status = 'suspended'
   ORDER BY m.reference_number, m.id`;

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

/** TypeORM implementation of the department pages' read-only port. */
export class CompanyDepartmentRepository implements ICompanyDepartmentPersistence {
  constructor(private readonly manager: EntityManager) {}

  async listContracts(
    scope: ICompanyOversightScope,
    workspace: AssignableContractWorkspace,
    roles: ContractRole[],
    options: { includeArchived: boolean; now: Date },
  ): Promise<IDepartmentContractRecord[]> {
    const rows = await this.manager.query<DepartmentRow[]>(
      DEPARTMENT_CONTRACTS_SQL,
      [
        scope.companyId,
        workspace,
        roles,
        options.includeArchived,
        options.now,
        scope.companyUserId,
      ],
    );
    return rows.map((row) => ({
      contractId: row.id,
      referenceNumber: row.reference_number,
      title: row.title,
      status: row.status,
      archived: Boolean(row.archived),
      ownerCompanyId: row.owner_company_id,
      ownerCompanyName: row.owner_company_name,
      partyType: row.party_type,
      contractUpdatedAt: toDate(row.updated_at),
      lastStatusChangeAt: row.last_status_change_at
        ? toDate(row.last_status_change_at)
        : null,
      suspendedByCompanyId: row.suspended_by_company_id,
      suspendedByCompanyName: row.suspended_by_company_name,
      parties: row.parties.map((party) => ({
        ...party,
        signedAt: party.signedAt ? new Date(party.signedAt) : null,
      })),
      pendingPartyInvitations: row.pending_party_invitations,
      members: row.members,
      pendingRoleInvitationCount: Number(row.pending_role_invitations),
      requesterHasRole: Boolean(row.requester_has_role),
    }));
  }
}
