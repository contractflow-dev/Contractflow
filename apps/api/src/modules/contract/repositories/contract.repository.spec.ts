import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractRepository } from './contract.repository';

function createQb() {
  const sub = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getQuery: vi.fn().mockReturnValue('(SELECT 1)'),
  };
  const qb = {
    alias: 'contract',
    subQuery: vi.fn().mockReturnValue(sub),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(null),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  return { qb, sub };
}

describe('ContractRepository', () => {
  const orm = { createQueryBuilder: vi.fn() };
  let repository: ContractRepository;
  let qb: ReturnType<typeof createQb>['qb'];
  let sub: ReturnType<typeof createQb>['sub'];

  beforeEach(() => {
    vi.resetAllMocks();
    ({ qb, sub } = createQb());
    orm.createQueryBuilder.mockReturnValue(qb);
    repository = new ContractRepository(orm as never);
  });

  it('limits every read to contracts the company is party to', async () => {
    await repository.searchPage({ companyId: 'co-1' });

    expect(sub.andWhere).toHaveBeenCalledWith(
      'scope_party.companyId = :__scopeCompanyId',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', {
      __scopeCompanyId: 'co-1',
    });
  });

  it('applies the party restriction when loading one contract', async () => {
    await repository.findById('c-1', { companyId: 'co-1' });

    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', {
      __scopeCompanyId: 'co-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('contract.id = :id', { id: 'c-1' });
  });

  it('escapes search wildcards and pages the result', async () => {
    await repository.searchPage(
      { companyId: 'co-1' },
      { search: '50%_', skip: 5, take: 5 },
    );

    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      search: '%50\\%\\_%',
    });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('refuses a blank company scope', async () => {
    await expect(repository.searchPage({ companyId: ' ' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('disables the unscoped generic methods', () => {
    expect(() => repository.findAll()).toThrow(ForbiddenException);
    expect(() => repository.findOne()).toThrow(ForbiddenException);
    expect(() => repository.findPage()).toThrow(ForbiddenException);
    expect(() => repository.save()).toThrow(ForbiddenException);
    expect(() => repository.update()).toThrow(ForbiddenException);
    expect(() => repository.delete()).toThrow(ForbiddenException);
  });
});
