import { EMilestoneStatus } from '@contractflow/contracts-schema';

/**
 * The controlled transition of legacy milestones into the workflow (approved
 * 22 November 2026, rule 9). Nothing is mapped automatically: an operator
 * inspects the records first (docs/legacy-milestone-status-report.sql), then
 * passes an explicit mapping. The original status is kept in
 * `legacy_status`; approved and completed milestones are never touched.
 */

/** Legacy statuses the workflow can't move a milestone out of. */
export const LEGACY_SOURCE_STATUSES = [
  EMilestoneStatus.ACTIVE,
  EMilestoneStatus.DELAYED,
  EMilestoneStatus.AT_RISK,
] as const;
export type LegacySourceStatus = (typeof LEGACY_SOURCE_STATUSES)[number];

/**
 * Statuses a legacy milestone may move to: those the workflow continues from
 * without inventing a submission or an approval.
 */
export const LEGACY_TARGET_STATUSES = [
  EMilestoneStatus.PLANNED,
  EMilestoneStatus.IN_PROGRESS,
] as const;
export type LegacyTargetStatus = (typeof LEGACY_TARGET_STATUSES)[number];

export type LegacyMapping = ReadonlyMap<LegacySourceStatus, LegacyTargetStatus>;

/** A milestone as the transition reads it. */
export interface LegacyMilestoneRow {
  id: string;
  contractId: string;
  title: string;
  status: string;
  legacyStatus: string | null;
}

export interface LegacyChange {
  id: string;
  contractId: string;
  title: string;
  from: LegacySourceStatus;
  to: LegacyTargetStatus;
}

export interface LegacyPlan {
  changes: LegacyChange[];
  skipped: Array<{ id: string; title: string; status: string; reason: string }>;
}

/** Parses `from=to` pairs; refuses anything outside the allowed statuses. */
export function parseLegacyMapping(pairs: readonly string[]): LegacyMapping {
  if (!pairs.length) {
    throw new Error(
      'Give at least one --map from=to, such as --map at_risk=in_progress. Nothing is mapped by default.',
    );
  }
  const mapping = new Map<LegacySourceStatus, LegacyTargetStatus>();
  for (const pair of pairs) {
    const [from, to, extra] = pair.split('=').map((part) => part.trim());
    if (!from || !to || extra !== undefined) {
      throw new Error(`"${pair}" isn't a from=to pair.`);
    }
    if (!(LEGACY_SOURCE_STATUSES as readonly string[]).includes(from)) {
      throw new Error(
        `"${from}" can't be transitioned: only ${LEGACY_SOURCE_STATUSES.join(', ')} can.`,
      );
    }
    if (!(LEGACY_TARGET_STATUSES as readonly string[]).includes(to)) {
      throw new Error(
        `"${to}" isn't an allowed target: use ${LEGACY_TARGET_STATUSES.join(' or ')}.`,
      );
    }
    if (mapping.has(from as LegacySourceStatus)) {
      throw new Error(`"${from}" is mapped twice.`);
    }
    mapping.set(from as LegacySourceStatus, to as LegacyTargetStatus);
  }
  return mapping;
}

/** What the mapping would change, and what it leaves alone and why. */
export function planLegacyTransition(
  rows: readonly LegacyMilestoneRow[],
  mapping: LegacyMapping,
): LegacyPlan {
  const plan: LegacyPlan = { changes: [], skipped: [] };
  for (const row of rows) {
    const skip = (reason: string) =>
      plan.skipped.push({
        id: row.id,
        title: row.title,
        status: row.status,
        reason,
      });
    if (row.legacyStatus) {
      skip(`already transitioned from ${row.legacyStatus}`);
      continue;
    }
    const to = mapping.get(row.status as LegacySourceStatus);
    if (!to) {
      skip('its status is not in the mapping');
      continue;
    }
    plan.changes.push({
      id: row.id,
      contractId: row.contractId,
      title: row.title,
      from: row.status as LegacySourceStatus,
      to,
    });
  }
  return plan;
}
