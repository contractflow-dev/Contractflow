import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityLog } from '../entities/activity-log.entity';
import { ActivityLogRepository } from './activity-log.repository';

describe('ActivityLogRepository', () => {
  const parties = { exists: vi.fn() };
  const repository = {
    findAndCount: vi.fn(),
    manager: { getRepository: vi.fn() },
  };
  const scope = { contractId: 'contract-1', companyId: 'company-1' };
  let activityLogs: ActivityLogRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    parties.exists.mockResolvedValue(true);
    repository.manager.getRepository.mockReturnValue(parties);
    repository.findAndCount.mockResolvedValue([[], 0]);
    activityLogs = new ActivityLogRepository(
      repository as unknown as Repository<ActivityLog>,
    );
  });

  it('requires the company to be a party and scopes results to the requested contract', async () => {
    await activityLogs.findPage(scope, { skip: 0, take: 10 });

    expect(parties.exists).toHaveBeenCalledWith({
      where: { contractId: scope.contractId, companyId: scope.companyId },
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contractId: scope.contractId, companyId: scope.companyId },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('does not query activity when the company is not a party to the contract', async () => {
    parties.exists.mockResolvedValue(false);

    await expect(
      activityLogs.findPage(scope, { skip: 0, take: 10 }),
    ).rejects.toThrow('Contract was not found');
    expect(repository.findAndCount).not.toHaveBeenCalled();
  });
});
