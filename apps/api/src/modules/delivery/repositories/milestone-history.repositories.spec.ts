import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import {
  MilestoneDecisionRepository,
  MilestoneOutstandingItemRepository,
  MilestoneSubmissionEvidenceRepository,
  MilestoneSubmissionItemRepository,
  MilestoneSubmissionRepository,
} from './milestone-history.repositories';

const scope = { contractId: 'contract-1', companyId: 'company-1' };

function typeOrmRepository() {
  return {
    update: vi.fn(),
    delete: vi.fn(),
    manager: { getRepository: vi.fn() },
  } as unknown as Repository<never>;
}

describe('milestone history repositories', () => {
  it.each([
    ['submissions', MilestoneSubmissionRepository],
    ['decisions', MilestoneDecisionRepository],
    ['evidence', MilestoneSubmissionEvidenceRepository],
    ['covered items', MilestoneSubmissionItemRepository],
    ['outstanding items', MilestoneOutstandingItemRepository],
  ])('refuse to update or delete %s', async (_name, RepositoryClass) => {
    const repository = typeOrmRepository();
    const history = new RepositoryClass(repository as never);

    await expect(history.update()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(history.delete()).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('accepts outstanding items once, only within the scoped contract', async () => {
    const repository = typeOrmRepository();
    const parties = { exists: vi.fn().mockResolvedValue(true) };
    (
      repository.manager.getRepository as ReturnType<typeof vi.fn>
    ).mockReturnValue(parties);
    (repository.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      affected: 1,
    });
    const items = new MilestoneOutstandingItemRepository(repository as never);
    const at = new Date('2026-11-21T10:00:00Z');

    await expect(
      items.accept(scope, ['item-1'], 'decision-2', at),
    ).resolves.toBe(1);

    const [where, values] = (repository.update as ReturnType<typeof vi.fn>).mock
      .calls[0];
    // Only still-open items of this contract match; accepted ones are left alone.
    expect(where).toMatchObject({ contractId: 'contract-1' });
    expect(where.acceptedByDecisionId).toBeDefined();
    expect(values).toEqual({
      acceptedByDecisionId: 'decision-2',
      acceptedAt: at,
    });
    // The scope company must be a party first.
    expect(parties.exists).toHaveBeenCalledWith({
      where: { contractId: 'contract-1', companyId: 'company-1' },
    });
  });
});
