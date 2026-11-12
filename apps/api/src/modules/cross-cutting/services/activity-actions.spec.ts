import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CONTRACT_ACTIVITY_ACTIONS } from '@contractflow/contracts-schema';
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
        /'((?:contract|document)\.[a-z_]+)'/g,
      )) {
        written.add(match[1]);
      }
    }

    // A new action must be added to the shared list (the action filter
    // accepts only listed values), and a listed action must still be written.
    expect([...written].sort()).toEqual([...CONTRACT_ACTIVITY_ACTIONS].sort());
  });
});
