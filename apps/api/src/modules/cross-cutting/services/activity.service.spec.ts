import { ForbiddenException } from '@nestjs/common';
import type { ContractAccessService } from '../../contract/services/contract-access.service';
import type { ActivityLogRepository } from '../repositories/activity-log.repository';
import { ActivityService } from './activity.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ActivityService', () => {
  const scope = { contractId: 'c1', companyId: 'co1' };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let activityLogs: { findPage: ReturnType<typeof vi.fn> };
  let service: ActivityService;

  beforeEach(() => {
    access = { authorize: vi.fn().mockResolvedValue(scope) };
    activityLogs = { findPage: vi.fn() };
    service = new ActivityService(
      access as unknown as ContractAccessService,
      activityLogs as unknown as ActivityLogRepository,
    );
  });

  it('pages within the authorized contract scope and reports its total', async () => {
    activityLogs.findPage.mockResolvedValue({
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
        },
      ],
      total: 41,
    });

    const result = await service.listForContract('u1', 'co1', 'c1', {
      page: 3,
      limit: 20,
    });

    expect(access.authorize).toHaveBeenCalledWith('u1', 'co1', 'c1', 'general');
    expect(activityLogs.findPage).toHaveBeenCalledWith(scope, {
      order: { occurredAt: 'DESC', id: 'ASC' },
      skip: 40,
      take: 20,
    });
    expect(result.meta).toEqual({
      totalItems: 41,
      itemCount: 1,
      itemsPerPage: 20,
      totalPages: 3,
      currentPage: 3,
    });
    expect(result.data[0]).not.toHaveProperty('ipAddress');
    expect(result.data[0]).not.toHaveProperty('userAgent');
  });

  it('does not query or count records when access is denied', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(
      service.listForContract('u1', 'co1', 'c1', { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(activityLogs.findPage).not.toHaveBeenCalled();
  });
});
