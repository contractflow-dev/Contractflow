import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_LIMITS,
  InvalidActivityEntryError,
  buildActivityEntry,
  type ActivityEntryInput,
} from './activity-entry';

const CONTRACT = '01J0000000000000000000000C';
const COMPANY = '01J0000000000000000000000A';
const ACTOR = '01J0000000000000000000000B';
const MILESTONE = '01J0000000000000000000000M';

function input(
  overrides: Partial<ActivityEntryInput> = {},
): ActivityEntryInput {
  return {
    contractId: CONTRACT,
    companyId: COMPANY,
    actorUserId: ACTOR,
    action: 'milestone.rejected',
    entityType: 'milestone',
    entityId: MILESTONE,
    summary: 'Rejected milestone M3.',
    changes: {
      before: { status: 'pending_approval' },
      after: { status: 'rejected' },
    },
    occurredAt: new Date('2026-11-21T09:30:00.000+01:00'),
    ...overrides,
  };
}

describe('buildActivityEntry', () => {
  it('builds the row with the affected record, previous and new state, and the reason', () => {
    const entry = buildActivityEntry(
      input({
        workspace: 'project',
        reason: '  Evidence is missing the test certificate.  ',
      }),
    );

    expect(entry).toEqual({
      contractId: CONTRACT,
      companyId: COMPANY,
      actorUserId: ACTOR,
      action: 'milestone.rejected',
      entityType: 'milestone',
      entityId: MILESTONE,
      summary: 'Rejected milestone M3.',
      changes: {
        before: { status: 'pending_approval' },
        after: { status: 'rejected' },
      },
      metadata: {},
      workspace: 'project',
      reason: 'Evidence is missing the test certificate.',
      ipAddress: null,
      userAgent: null,
      requestId: null,
      occurredAt: new Date('2026-11-21T08:30:00.000Z'),
    });
  });

  it('stores the instant in UTC and copies it, so later changes to the input can’t alter it', () => {
    const occurredAt = new Date('2026-11-21T08:30:00.000Z');
    const entry = buildActivityEntry(input({ occurredAt }));
    occurredAt.setUTCFullYear(2000);

    expect(entry.occurredAt.toISOString()).toBe('2026-11-21T08:30:00.000Z');
  });

  it('defaults contract-wide entries to no workspace, no reason and empty change sets', () => {
    const entry = buildActivityEntry(
      input({ changes: undefined, workspace: undefined, reason: '   ' }),
    );
    expect(entry.workspace).toBeNull();
    expect(entry.reason).toBeNull();
    expect(entry.changes).toEqual({ before: null, after: null });
  });

  it('accepts the UUIDs older records use as ids', () => {
    expect(
      buildActivityEntry(
        input({ entityId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }),
      ).entityId,
    ).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it.each([
    ['contractId', { contractId: '' }],
    ['companyId', { companyId: 'company-1' }],
    ['actorUserId', { actorUserId: undefined as unknown as string }],
    ['entityId', { entityId: 'not an id' }],
  ])('refuses an entry without a valid %s', (_field, overrides) => {
    expect(() => buildActivityEntry(input(overrides))).toThrow(
      InvalidActivityEntryError,
    );
  });

  it.each([
    'Milestone.Rejected',
    'rejected',
    'milestone.',
    'milestone rejected',
  ])('refuses the action name "%s"', (action) => {
    expect(() => buildActivityEntry(input({ action }))).toThrow(/action/);
  });

  it('refuses an entity type that is not snake_case, an empty summary and an unknown workspace', () => {
    expect(() =>
      buildActivityEntry(input({ entityType: 'Milestone' })),
    ).toThrow(/entityType/);
    expect(() => buildActivityEntry(input({ summary: '  ' }))).toThrow(
      /summary/,
    );
    expect(() =>
      buildActivityEntry(input({ workspace: 'payroll' as unknown as 'hse' })),
    ).toThrow(/workspace/);
  });

  it('refuses an invalid date', () => {
    expect(() =>
      buildActivityEntry(input({ occurredAt: new Date('not a date') })),
    ).toThrow(/occurredAt/);
  });

  it('shortens a long summary but refuses an over-long reason', () => {
    expect(
      buildActivityEntry(input({ summary: 'x'.repeat(800) })).summary,
    ).toHaveLength(ACTIVITY_LIMITS.summary);
    expect(() =>
      buildActivityEntry(
        input({ reason: 'x'.repeat(ACTIVITY_LIMITS.reason + 1) }),
      ),
    ).toThrow(/reason/);
  });

  it('refuses change sets too large to be a list of changed fields', () => {
    expect(() =>
      buildActivityEntry(
        input({
          changes: {
            before: null,
            after: { description: 'x'.repeat(ACTIVITY_LIMITS.details) },
          },
        }),
      ),
    ).toThrow(/larger than/);
  });

  it.each([
    ['a password', { after: { password: 'hunter2' } }],
    ['a token hash', { after: { invitation: { token_hash: 'abc' } } }],
    [
      'a session token in a list',
      { after: { sessions: [{ sessionToken: 'abc' }] } },
    ],
    ['an HSE injury description', { after: { injuryDescription: 'Fracture' } }],
    [
      'an HSE injury description (column name)',
      { before: { injury_description: 'x' } },
    ],
  ])('never records %s', (_label, changes) => {
    expect(() =>
      buildActivityEntry(
        input({
          changes: {
            before: null,
            after: null,
            ...(changes as Record<string, Record<string, unknown>>),
          },
        }),
      ),
    ).toThrow(/must not be recorded/);
  });

  it('checks metadata for the same keys', () => {
    expect(() =>
      buildActivityEntry(input({ metadata: { apiKey: 'secret' } })),
    ).toThrow(/metadata\.apiKey must not be recorded/);
  });
});
