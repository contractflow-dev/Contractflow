export type ContractActivityTargetType =
  | "contract_site"
  | "contract_party"
  | "contract_party_invitation"
  | "contract_role_assignment"
  | "contract_role_invitation"
  | "document";

export type ContractActivityTargetSection =
  "parties" | "roles" | "sites" | "signatories" | "documents";

export interface ContractActivityTarget {
  type: ContractActivityTargetType;
  id: string;
  section: ContractActivityTargetSection;
  versionId?: string;
  workspace?: "project" | "hse" | "finance";
}

/**
 * One entry of `GET /contract/activity`: an action that a member of the
 * caller's own company took on the contract. The API returns only the caller
 * company's entries, and keeps request details and change sets internal.
 */
export interface ContractActivityItem {
  id: string;
  /** Dotted action name, such as `contract.site_created` or `document.deleted`. */
  action: string;
  entityType: string;
  /**
   * A generated identifier for the log entry, not the changed record's id:
   * `activity_log.entity_id` is a uuid column and records use ULIDs.
   */
  entityId: string;
  /** A sentence the API wrote when the action happened. */
  summary: string;
  /** The acting company membership (`company_user.id`), not the user id. */
  actorUserId: string;
  /**
   * The acting member's "First Last". Resolved only within the caller's own
   * company; null when the actor can't be resolved there or has no name.
   */
  actorName: string | null;
  /** A safe, authorization-neutral reference to the affected record. */
  target: ContractActivityTarget | null;
  /** ISO 8601 timestamp. */
  occurredAt: string;
}

/**
 * Every action the API writes to a contract's activity log. The API accepts
 * only these as the `action` filter; a unit test in the API keeps this list
 * in step with the actions its services write.
 */
export const CONTRACT_ACTIVITY_ACTIONS = [
  "contract.workspaces_added",
  "contract.workspaces_removed",
  "contract.status_transitioned",
  "contract.deleted",
  "contract.restored",
  "contract.site_created",
  "contract.site_updated",
  "contract.signatory_recorded",
  "contract.party_invitation_created",
  "contract.party_invitation_revoked",
  "contract.party_invitation_accepted",
  "contract.party_invitation_rejected",
  "contract.role_assigned",
  "contract.role_revoked",
  "contract.role_invitation_created",
  "contract.role_invitation_revoked",
  "contract.workspace_admin_granted",
  "contract.workspace_admin_revoked",
  "document.upload_initiated",
  "document.upload_completed",
  "document.upload_failed",
  "document.version_added",
  "document.downloaded",
  "document.deleted",
] as const;

export type ContractActivityAction = (typeof CONTRACT_ACTIVITY_ACTIONS)[number];

/**
 * Optional filters of `GET /contract/activity`, sent as query parameters
 * beside `page` and `limit`. Each one narrows the caller's own company's
 * entries; none can widen them.
 *
 * `fromDate` and `toDate` are inclusive. Each is either an ISO 8601 instant
 * with a time zone (`2026-11-10T00:00:00+01:00`, `…Z`) or a calendar day
 * (`2026-11-10`), read as that UTC day: from its first millisecond, to its
 * last. An instant without a zone is rejected as ambiguous.
 */
export interface ContractActivityFilters {
  fromDate?: string;
  toDate?: string;
  /** An actor's company membership id, as `actorUserId` in the entries. */
  actorUserId?: string;
  action?: ContractActivityAction;
}

/**
 * One option of the actor filter, from `GET /contract/activity/actors`: a
 * member of the caller's company with activity on the contract.
 */
export interface ContractActivityActor {
  actorUserId: string;
  /** "First Last"; null when the member has no name. */
  actorName: string | null;
}
