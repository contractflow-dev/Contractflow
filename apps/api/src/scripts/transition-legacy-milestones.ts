import { config } from 'dotenv';
import type { DataSource } from 'typeorm';
import dataSource from '../common/database/data-source';
import { LegacyMilestoneTransitionRepository } from '../modules/delivery/repositories/legacy-milestone-transition.repository';
import {
  LEGACY_SOURCE_STATUSES,
  parseLegacyMapping,
  planLegacyTransition,
  type LegacyMapping,
  type LegacyPlan,
} from '../modules/delivery/services/legacy-milestone-transition';

config({ path: ['.env', '../../.env'] });

/**
 * Moves legacy milestones (active, delayed, at_risk) into the workflow by an
 * explicit mapping, keeping each original status in `legacy_status`.
 *
 *   pnpm --filter @contractflow/api milestones:legacy-transition -- \
 *     --map at_risk=in_progress --map active=in_progress [--contract <id>] [--apply]
 *
 * Without --apply it is a dry run: it prints what would change and changes
 * nothing. With --apply, every change is made in one transaction, or none.
 * Run docs/legacy-milestone-status-report.sql first, and only as an
 * authorized operator against the intended database.
 */
export interface LegacyTransitionOptions {
  mapping: LegacyMapping;
  contractId?: string;
  apply: boolean;
}

export async function runLegacyMilestoneTransition(
  source: DataSource,
  options: LegacyTransitionOptions,
): Promise<LegacyPlan & { applied: boolean; moved: number }> {
  return source.transaction(async (manager) => {
    const repository = new LegacyMilestoneTransitionRepository(manager);
    const rows = await repository.findCandidates(
      LEGACY_SOURCE_STATUSES,
      options.contractId,
    );
    const plan = planLegacyTransition(rows, options.mapping);
    if (!options.apply) return { ...plan, applied: false, moved: 0 };
    const moved = await repository.apply(plan.changes);
    if (moved !== plan.changes.length) {
      // Something changed between the read and the update: undo it all.
      throw new Error(
        `Expected to move ${plan.changes.length} milestone(s) but moved ${moved}; nothing was changed. Run it again.`,
      );
    }
    return { ...plan, applied: true, moved };
  });
}

function parseArguments(argv: readonly string[]): LegacyTransitionOptions {
  const maps: string[] = [];
  let contractId: string | undefined;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--map') maps.push(argv[++index] ?? '');
    else if (argument === '--contract') contractId = argv[++index];
    else if (argument === '--apply') apply = true;
    else if (argument !== '--')
      throw new Error(`Unknown argument "${argument}".`);
  }
  return { mapping: parseLegacyMapping(maps), contractId, apply };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  await dataSource.initialize();
  try {
    const result = await runLegacyMilestoneTransition(dataSource, options);
    console.log(
      JSON.stringify(
        {
          mode: result.applied ? 'applied' : 'dry run (nothing changed)',
          mapping: Object.fromEntries(options.mapping),
          moved: result.moved,
          changes: result.changes,
          skipped: result.skipped,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

if (
  process.argv[1] &&
  process.argv[1]
    .replace(/\\/g, '/')
    .endsWith('transition-legacy-milestones.ts')
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Legacy milestone transition failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  });
}
