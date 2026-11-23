import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTRACT_ACTIVITY_ACTIONS,
  MILESTONE_ACTIVITY_ACTIONS,
  MILESTONE_DECISION_ACTIONS,
  STAGE_ACTIVITY_ACTIONS,
} from '@contractflow/contracts-schema';
import { describe, expect, it } from 'vitest';

/** Every non-test service file under `src/modules`. */
function serviceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return serviceFiles(path);
    return /[\\/]services[\\/][^\\/]+\.ts$/.test(path) &&
      !path.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

describe('CONTRACT_ACTIVITY_ACTIONS', () => {
  it('lists exactly the actions the services write to the activity log', () => {
    const written = new Set<string>();
    for (const file of serviceFiles(join(__dirname, '..', '..'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(
        /'((?:contract|document|stage|milestone)\.[a-z_]+)'/g,
      )) {
        written.add(match[1]);
      }
    }

    // A new action must be added to the shared list (the action filter
    // accepts only listed values), and a listed action must still be written.
    expect([...written].sort()).toEqual([...CONTRACT_ACTIVITY_ACTIONS].sort());
  });

  it('groups every Project workspace action as a stage or a milestone action', () => {
    const project = CONTRACT_ACTIVITY_ACTIONS.filter((action) =>
      /^(stage|milestone)\./.test(action),
    );
    expect(
      [...STAGE_ACTIVITY_ACTIONS, ...MILESTONE_ACTIVITY_ACTIONS].sort(),
    ).toEqual([...project].sort());
    expect(STAGE_ACTIVITY_ACTIONS.every((a) => a.startsWith('stage.'))).toBe(
      true,
    );
    expect(
      MILESTONE_ACTIVITY_ACTIONS.every((a) => a.startsWith('milestone.')),
    ).toBe(true);
    for (const action of MILESTONE_DECISION_ACTIONS) {
      expect(MILESTONE_ACTIVITY_ACTIONS).toContain(action);
    }
  });

  it('names every action area.verb_noun', () => {
    for (const action of CONTRACT_ACTIVITY_ACTIONS) {
      expect(action).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
    }
  });
});
