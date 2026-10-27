import type { Repository, SelectQueryBuilder } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRoleAssignmentRepository } from './contract-role-assignment.repository';

describe('ContractRoleAssignmentRepository', () => {
  const queryBuilder = {
    alias: 'e',
    andWhere: vi.fn(),
    getMany: vi.fn(),
  };
  const repository = { createQueryBuilder: vi.fn() };
  let assignments: ContractRoleAssignmentRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    queryBuilder.andWhere.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<ContractRoleAssignment>,
    );
    queryBuilder.getMany.mockResolvedValue([]);
    repository.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<ContractRoleAssignment>,
    );
    assignments = new ContractRoleAssignmentRepository(
      repository as unknown as Repository<ContractRoleAssignment>,
    );
  });

  it('returns active assignments only within the supplied company and user', async () => {
    await assignments.findActiveByCompanyUser('member-1', {
      companyId: 'company-1',
    });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('e');
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'e.companyId = :__scopeCompanyId',
      { __scopeCompanyId: 'company-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'e.companyUserId = :companyUserId AND e.revokedAt IS NULL',
      { companyUserId: 'member-1' },
    );
    expect(queryBuilder.getMany).toHaveBeenCalledOnce();
  });
});
