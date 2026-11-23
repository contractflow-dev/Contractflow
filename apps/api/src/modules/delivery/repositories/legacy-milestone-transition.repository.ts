import { In, IsNull, type EntityManager } from 'typeorm';
import { Milestone } from '../entities/milestone.entity';
import type {
  LegacyChange,
  LegacyMilestoneRow,
  LegacySourceStatus,
} from '../services/legacy-milestone-transition';

/**
 * Operator-only queries for the legacy milestone transition. They read and
 * change milestones across contracts, so they're used only by the transition
 * script, run by someone with direct database access; no API route reaches
 * them.
 */
export class LegacyMilestoneTransitionRepository {
  constructor(private readonly manager: EntityManager) {}

  /** Milestones in the legacy statuses, optionally of one contract, locked. */
  async findCandidates(
    statuses: readonly LegacySourceStatus[],
    contractId?: string,
  ): Promise<LegacyMilestoneRow[]> {
    const rows = await this.manager.getRepository(Milestone).find({
      where: {
        status: In([...statuses]),
        ...(contractId ? { contractId } : {}),
      },
      select: {
        id: true,
        contractId: true,
        title: true,
        status: true,
        legacyStatus: true,
      },
      order: { contractId: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    return rows.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      title: row.title,
      status: row.status,
      legacyStatus: row.legacyStatus ?? null,
    }));
  }

  /**
   * Moves each milestone to its new status, keeping the old one in
   * `legacy_status`. A row that changed since it was read (another status,
   * or already transitioned) is left alone. Returns how many moved.
   */
  async apply(changes: readonly LegacyChange[]): Promise<number> {
    let moved = 0;
    for (const change of changes) {
      const result = await this.manager
        .getRepository(Milestone)
        .update(
          { id: change.id, status: change.from, legacyStatus: IsNull() },
          { status: change.to, legacyStatus: change.from },
        );
      moved += result.affected ?? 0;
    }
    return moved;
  }
}
