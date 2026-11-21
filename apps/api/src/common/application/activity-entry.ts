/**
 * One audit entry for `activity_log`, validated before it is written.
 *
 * Every contract-scoped operation that changes data records what happened
 * through this builder, inside the same Unit of Work transaction as the change
 * itself, so a failed operation never leaves a "succeeded" entry behind. The
 * infrastructure (transaction-context factories) calls it; application
 * services pass the input through their context's activity port. See
 * `docs/AUDIT_LOG.md`.
 *
 * It holds no persistence code, so it can be used from any layer.
 */

/** The contract workspaces an entry can belong to. */
export const ACTIVITY_WORKSPACES = ['project', 'hse', 'finance'] as const;
export type ActivityWorkspace = (typeof ACTIVITY_WORKSPACES)[number];

/** Limits that keep entries small and bounded. */
export const ACTIVITY_LIMITS = Object.freeze({
  summary: 500,
  reason: 2000,
  /** Serialized size of `changes` plus `metadata`, in characters. */
  details: 16_000,
});

/** `area.verb_noun`, such as `contract.site_created` or `milestone.approved`. */
const ACTION = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
/** `snake_case`, such as `contract_role_assignment`. */
const ENTITY_TYPE = /^[a-z][a-z0-9_]{0,59}$/;
/** A ULID (26) or a UUID (36): the ids records and legacy entries use. */
const RECORD_ID =
  /^(?:[0-9A-HJKMNP-TV-Z]{26}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Keys that must never reach the log: credentials, and the encrypted HSE
 * injury description. Compared without case, `_` or `-`, at any depth.
 */
const FORBIDDEN_KEYS = new Set(
  [
    'password',
    'passwordHash',
    'token',
    'tokenHash',
    'accessToken',
    'refreshToken',
    'sessionToken',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    'injuryDescription',
  ].map(normalizeKey),
);

export interface ActivityEntryInput {
  contractId: string;
  /** The acting company, from the authorized server-side scope. */
  companyId: string;
  /** The acting company membership (`company_user.id`), never a client value. */
  actorUserId: string;
  action: string;
  /** The kind of record affected, in `snake_case`. */
  entityType: string;
  /** The affected record's own id. */
  entityId: string;
  /** A short sentence for people reading the log. */
  summary: string;
  /** Only the fields that changed, before and after. */
  changes?: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
  /** References that are not changes, such as a related record's id. */
  metadata?: Record<string, unknown>;
  /** The workspace whose content changed; omit for contract-wide actions. */
  workspace?: ActivityWorkspace | null;
  /** The explanation given for the action, where one is asked for. */
  reason?: string | null;
  requestId?: string | null;
  /** When it happened; stored as a UTC instant. */
  occurredAt: Date;
}

/** The validated columns of one `activity_log` row. */
export interface ActivityEntryValues {
  contractId: string;
  companyId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
  metadata: Record<string, unknown>;
  workspace: ActivityWorkspace | null;
  reason: string | null;
  ipAddress: null;
  userAgent: null;
  requestId: string | null;
  occurredAt: Date;
}

/** An entry that can't be written as given: a defect in the calling code. */
export class InvalidActivityEntryError extends Error {
  constructor(message: string) {
    super(`Invalid activity entry: ${message}`);
    this.name = 'InvalidActivityEntryError';
  }
}

export function buildActivityEntry(
  input: ActivityEntryInput,
): ActivityEntryValues {
  const contractId = requireId(input.contractId, 'contractId');
  const companyId = requireId(input.companyId, 'companyId');
  const actorUserId = requireId(input.actorUserId, 'actorUserId');
  const entityId = requireId(input.entityId, 'entityId');
  if (!ACTION.test(input.action ?? '')) {
    throw new InvalidActivityEntryError(
      `action "${input.action}" must look like "area.verb_noun"`,
    );
  }
  if (!ENTITY_TYPE.test(input.entityType ?? '')) {
    throw new InvalidActivityEntryError(
      `entityType "${input.entityType}" must be snake_case`,
    );
  }
  const summary = (input.summary ?? '').trim();
  if (!summary) {
    throw new InvalidActivityEntryError('summary is required');
  }
  const workspace = input.workspace ?? null;
  if (workspace !== null && !ACTIVITY_WORKSPACES.includes(workspace)) {
    throw new InvalidActivityEntryError(`unknown workspace "${workspace}"`);
  }
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > ACTIVITY_LIMITS.reason) {
    throw new InvalidActivityEntryError(
      `reason is longer than ${ACTIVITY_LIMITS.reason} characters`,
    );
  }
  if (
    !(input.occurredAt instanceof Date) ||
    Number.isNaN(input.occurredAt.getTime())
  ) {
    throw new InvalidActivityEntryError('occurredAt must be a valid date');
  }
  const changes = input.changes ?? { before: null, after: null };
  const metadata = input.metadata ?? {};
  rejectForbiddenKeys(changes, 'changes');
  rejectForbiddenKeys(metadata, 'metadata');
  const size = JSON.stringify(changes).length + JSON.stringify(metadata).length;
  if (size > ACTIVITY_LIMITS.details) {
    throw new InvalidActivityEntryError(
      `changes and metadata are larger than ${ACTIVITY_LIMITS.details} characters; record only the fields that changed`,
    );
  }
  return {
    contractId,
    companyId,
    actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId,
    // Long generated sentences are shortened rather than lost.
    summary: summary.slice(0, ACTIVITY_LIMITS.summary),
    changes,
    metadata,
    workspace,
    reason,
    ipAddress: null,
    userAgent: null,
    requestId: input.requestId ?? null,
    occurredAt: new Date(input.occurredAt.getTime()),
  };
}

function requireId(value: string | undefined, field: string): string {
  const id = value?.trim() ?? '';
  if (!RECORD_ID.test(id)) {
    throw new InvalidActivityEntryError(`${field} must be a ULID or UUID`);
  }
  return id;
}

function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

function rejectForbiddenKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenKeys(item, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
      throw new InvalidActivityEntryError(
        `${path}.${key} must not be recorded`,
      );
    }
    rejectForbiddenKeys(child, `${path}.${key}`);
  }
}
