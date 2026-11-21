import type {
  ContractActivityTarget,
  ContractActivityWorkspace,
} from '@contractflow/contracts-schema';

/** Validated activity filters, as the repository applies them. */
export interface ActivityLogFilter {
  /** Inclusive lower bound of `occurred_at`. */
  fromDate?: Date;
  /** Inclusive upper bound of `occurred_at`. */
  toDate?: Date;
  /** The acting company membership. */
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  workspace?: ContractActivityWorkspace;
}

/**
 * The workspaces whose entries the reader may see: those their contract
 * roles open. Contract-wide entries (no workspace) are always visible.
 */
export interface ActivityVisibility {
  workspaces: readonly ContractActivityWorkspace[];
}

/** A member of the caller's company with activity on a contract. */
export interface ActivityActorRecord {
  actorUserId: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  workspace: ContractActivityWorkspace | null;
  reason: string | null;
  summary: string;
  actorUserId: string;
  /** "First Last" of the acting member of the caller's company; null if unresolved. */
  actorName: string | null;
  target: ContractActivityTarget | null;
  occurredAt: Date;
}
