import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ContractAccessService } from '../../contract/services/contract-access.service';
import type { ActivityLogRepository } from '../repositories/activity-log.repository';
import { ActivityService } from './activity.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ActivityService', () => {
  const scope = { contractId: 'c1', companyId: 'co1' };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let activityLogs: { findPageWithActorNames: ReturnType<typeof vi.fn> };
  let service: ActivityService;

  beforeEach(() => {
    access = { authorize: vi.fn().mockResolvedValue(scope) };
    activityLogs = { findPageWithActorNames: vi.fn() };
    service = new ActivityService(
      access as unknown as ContractAccessService,
      activityLogs as unknown as ActivityLogRepository,
    );
  });

  it('pages within the authorized contract scope and reports its total', async () => {
    activityLogs.findPageWithActorNames.mockResolvedValue({
      items: [
        {
          id: 'a1',
          action: 'contract.updated',
          entityType: 'contract',
          entityId: 'c1',
          summary: 'Updated',
          actorUserId: 'u1',
          occurredAt: new Date('2026-01-01T00:00:00.000Z'),
          ipAddress: '10.0.0.1',
          userAgent: 'test-agent',
          actorUser: {
            id: 'u1',
            user: {
              firstName: 'Ada',
              lastName: 'Okafor',
              email: 'ada@example.com',
            },
          },
        },
        {
          id: 'a2',
          action: 'contract.updated',
          entityType: 'contract',
          entityId: 'c1',
          summary: 'Updated',
          actorUserId: 'u9',
          occurredAt: new Date('2025-12-31T00:00:00.000Z'),
          // Not resolved within the caller's company.
          actorUser: null,
        },
      ],
      total: 41,
    });

    const result = await service.listForContract('u1', 'co1', 'c1', {
      page: 3,
      limit: 20,
    });

    expect(access.authorize).toHaveBeenCalledWith('u1', 'co1', 'c1', 'general');
    expect(activityLogs.findPageWithActorNames).toHaveBeenCalledWith(scope, {
      skip: 40,
      take: 20,
    });
    expect(result.meta).toEqual({
      totalItems: 41,
      itemCount: 2,
      itemsPerPage: 20,
      totalPages: 3,
      currentPage: 3,
    });
    expect(result.data[0]).not.toHaveProperty('ipAddress');
    expect(result.data[0]).not.toHaveProperty('userAgent');
    // Only the actor's name leaves the service, never the user record.
    expect(result.data[0].actorName).toBe('Ada Okafor');
    expect(JSON.stringify(result.data)).not.toContain('ada@example.com');
    expect(result.data[1].actorName).toBeNull();
  });

  it('does not query or count records when access is denied', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(
      service.listForContract('u1', 'co1', 'c1', { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(activityLogs.findPageWithActorNames).not.toHaveBeenCalled();
  });

  it('reads change-set targets from the stored `after` object, taking only the named id', async () => {
    const row = (
      id: string,
      action: string,
      changes: unknown,
    ) => ({
      id,
      action,
      entityType: 'contract',
      entityId: id,
      summary: action,
      actorUserId: 'u1',
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      changes,
      metadata: {},
      actorUser: null,
    });
    activityLogs.findPageWithActorNames.mockResolvedValue({
      items: [
        row('site', 'contract.site_created', {
          before: null,
          after: { siteId: 'site-1', siteCode: 'SECRET-CODE' },
        }),
        row('signatory', 'contract.signatory_recorded', {
          before: null,
          after: { contractPartyId: 'party-1', signedAt: '2026-01-01' },
        }),
        row('invitation', 'contract.party_invitation_created', {
          before: null,
          after: { invitationId: 'inv-1', email: 'private@example.com' },
        }),
        // Malformed change sets give no target rather than a wrong one.
        row('no-after', 'contract.site_updated', { before: null, after: null }),
        row('string-after', 'contract.site_updated', { after: 'site-2' }),
        row('array-after', 'contract.site_updated', { after: ['site-3'] }),
        row('numeric-id', 'contract.site_updated', { after: { siteId: 7 } }),
      ],
      total: 7,
    });

    const result = await service.listForContract('u1', 'co1', 'c1', {
      page: 1,
      limit: 20,
    });
    const targets = Object.fromEntries(
      result.data.map((item) => [item.id, item.target]),
    );

    expect(targets).toEqual({
      site: { type: 'contract_site', id: 'site-1', section: 'sites' },
      signatory: { type: 'contract_party', id: 'party-1', section: 'signatories' },
      invitation: {
        type: 'contract_party_invitation',
        id: 'inv-1',
        section: 'parties',
      },
      'no-after': null,
      'string-after': null,
      'array-after': null,
      'numeric-id': null,
    });
    const raw = JSON.stringify(result.data);
    for (const hidden of ['SECRET-CODE', 'private@example.com', 'site-2', 'site-3']) {
      expect(raw).not.toContain(hidden);
    }
  });
});

describe('ActivityService filters', () => {
  const scope = { contractId: 'c1', companyId: 'co1' };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let activityLogs: {
    findPageWithActorNames: ReturnType<typeof vi.fn>;
    findActors: ReturnType<typeof vi.fn>;
  };
  let service: ActivityService;
  const page = { page: 1, limit: 20 };

  beforeEach(() => {
    access = { authorize: vi.fn().mockResolvedValue(scope) };
    activityLogs = {
      findPageWithActorNames: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0 }),
      findActors: vi.fn(),
    };
    service = new ActivityService(
      access as unknown as ContractAccessService,
      activityLogs as unknown as ActivityLogRepository,
    );
  });

  const filterSent = () => activityLogs.findPageWithActorNames.mock.calls[0][1];

  it('reads calendar days as whole UTC days, both ends inclusive', async () => {
    await service.listForContract('u1', 'co1', 'c1', {
      ...page,
      fromDate: '2026-11-01',
      toDate: '2026-11-10',
    });

    expect(filterSent()).toMatchObject({
      fromDate: new Date('2026-11-01T00:00:00.000Z'),
      toDate: new Date('2026-11-10T23:59:59.999Z'),
      skip: 0,
      take: 20,
    });
  });

  it('uses zoned instants exactly, and passes actor and action through', async () => {
    await service.listForContract('u1', 'co1', 'c1', {
      ...page,
      fromDate: '2026-11-09T23:00:00.000Z',
      toDate: '2026-11-10T22:59:59.999+01:00',
      actorUserId: '01JACTOR000000000000000000',
      action: 'contract.site_created',
    });

    expect(filterSent()).toMatchObject({
      fromDate: new Date('2026-11-09T23:00:00.000Z'),
      toDate: new Date('2026-11-10T21:59:59.999Z'),
      actorUserId: '01JACTOR000000000000000000',
      action: 'contract.site_created',
    });
  });

  it('allows a single day and refuses an end before the start', async () => {
    await service.listForContract('u1', 'co1', 'c1', {
      ...page,
      fromDate: '2026-11-10',
      toDate: '2026-11-10',
    });
    expect(activityLogs.findPageWithActorNames).toHaveBeenCalledOnce();

    await expect(
      service.listForContract('u1', 'co1', 'c1', {
        ...page,
        fromDate: '2026-11-11',
        toDate: '2026-11-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(activityLogs.findPageWithActorNames).toHaveBeenCalledOnce();
  });

  it('lists actors only after authorizing, by name, with null for no name', async () => {
    activityLogs.findActors.mockResolvedValue([
      { actorUserId: 'm1', firstName: 'Ada', lastName: 'Okafor' },
      { actorUserId: 'm2', firstName: '', lastName: '' },
    ]);

    const actors = await service.listActors('u1', 'co1', 'c1');

    expect(access.authorize).toHaveBeenCalledWith('u1', 'co1', 'c1', 'general');
    expect(activityLogs.findActors).toHaveBeenCalledWith(scope);
    expect(actors).toEqual([
      { actorUserId: 'm1', actorName: 'Ada Okafor' },
      { actorUserId: 'm2', actorName: null },
    ]);
  });

  it('lists no actors when access is denied', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(service.listActors('u1', 'co1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(activityLogs.findActors).not.toHaveBeenCalled();
  });
});
