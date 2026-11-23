import { describe, expect, it } from 'vitest';
import {
  parseLegacyMapping,
  planLegacyTransition,
} from './legacy-milestone-transition';

const row = (
  id: string,
  status: string,
  legacyStatus: string | null = null,
) => ({
  id,
  contractId: 'contract-1',
  title: `Milestone ${id}`,
  status,
  legacyStatus,
});

describe('legacy milestone transition (approved rule 9)', () => {
  it('maps nothing by default', () => {
    expect(() => parseLegacyMapping([])).toThrow(
      /Nothing is mapped by default/,
    );
  });

  it('accepts only legacy sources and workflow-safe targets', () => {
    expect([
      ...parseLegacyMapping(['at_risk=in_progress', 'active=planned']),
    ]).toEqual([
      ['at_risk', 'in_progress'],
      ['active', 'planned'],
    ]);
    expect(() => parseLegacyMapping(['approved=in_progress'])).toThrow(
      /can't be transitioned/,
    );
    expect(() => parseLegacyMapping(['completed=planned'])).toThrow(
      /can't be transitioned/,
    );
    expect(() => parseLegacyMapping(['delayed=approved'])).toThrow(
      /isn't an allowed target/,
    );
    expect(() => parseLegacyMapping(['delayed=pending_approval'])).toThrow(
      /allowed target/,
    );
    expect(() =>
      parseLegacyMapping(['delayed=planned', 'delayed=in_progress']),
    ).toThrow(/mapped twice/);
    expect(() => parseLegacyMapping(['delayed'])).toThrow(/from=to/);
  });

  it('plans only mapped, untransitioned milestones and says why it skips the rest', () => {
    const plan = planLegacyTransition(
      [
        row('a', 'at_risk'),
        row('b', 'delayed'),
        row('c', 'in_progress', 'active'),
      ],
      parseLegacyMapping(['at_risk=in_progress']),
    );
    expect(plan.changes).toEqual([
      {
        id: 'a',
        contractId: 'contract-1',
        title: 'Milestone a',
        from: 'at_risk',
        to: 'in_progress',
      },
    ]);
    expect(plan.skipped.map(({ id, reason }) => [id, reason])).toEqual([
      ['b', 'its status is not in the mapping'],
      ['c', 'already transitioned from active'],
    ]);
  });
});
