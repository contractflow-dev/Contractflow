import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { ContractStatusHistoryRepository } from './contract-status-history.repository';

describe('ContractStatusHistoryRepository', () => {
  const exists = vi.fn();
  const find = vi.fn();
  const findOne = vi.fn();
  let repository: ContractStatusHistoryRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    exists.mockResolvedValue(true);
    find.mockResolvedValue([]);
    findOne.mockResolvedValue(null);
    repository = new ContractStatusHistoryRepository({
      manager: {
        getRepository: vi.fn().mockReturnValue({ exists }),
      },
      find,
      findOne,
    } as unknown as Repository<ContractStatusHistory>);
  });

  it('returns the timeline in ascending change order within the authorized contract', async () => {
    const scope = { contractId: 'contract-1', companyId: 'company-1' };

    await repository.findTimeline(scope);

    expect(exists).toHaveBeenCalledWith({
      where: { contractId: 'contract-1', companyId: 'company-1' },
    });
    expect(find).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' },
      order: { changedAt: 'ASC' },
    });
  });

  it('returns the latest status change in descending order', async () => {
    await repository.findLatest({
      contractId: 'contract-1',
      companyId: 'company-1',
    });

    expect(findOne).toHaveBeenCalledWith({
      where: { contractId: 'contract-1' },
      order: { changedAt: 'DESC' },
    });
  });

  it('does not query history for a company that is not a contract party', async () => {
    exists.mockResolvedValue(false);

    await expect(
      repository.findTimeline({
        contractId: 'contract-1',
        companyId: 'company-2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(find).not.toHaveBeenCalled();
  });
});
