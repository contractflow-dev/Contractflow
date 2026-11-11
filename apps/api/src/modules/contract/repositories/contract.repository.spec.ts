import { ForbiddenException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Contract } from '../entities/contract.entity';
import { ContractRepository } from './contract.repository';

function createQb() {
  const sub = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
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

const MEMBER = {
  companyId: 'co-1',
  companyUserId: 'cu-1',
  includeCompanyAdminOversight: false,
};
const OVERSIGHT = { ...MEMBER, includeCompanyAdminOversight: true };
const MEMBER_PARAMS = {
  __scopeCompanyId: 'co-1',
  __scopeCompanyUserId: 'cu-1',
  __scopeMemberStatus: 'active',
};

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

  it('limits an ordinary member to contracts they hold an active role on', async () => {
    await repository.searchPage(MEMBER);

    expect(sub.andWhere).toHaveBeenCalledWith(
      'scope_party.companyId = :__scopeCompanyId',
    );
    expect(sub.andWhere).toHaveBeenCalledWith(
      'scope_member.id = :__scopeCompanyUserId',
    );
    expect(sub.andWhere).toHaveBeenCalledWith(
      'scope_member.status = :__scopeMemberStatus',
    );
    expect(sub.andWhere).toHaveBeenCalledWith('scope_member.leftAt IS NULL');
    expect(sub.andWhere).toHaveBeenCalledWith('scope_assignment.revokedAt IS NULL');
    expect(sub.where).toHaveBeenCalledWith(
      'scope_assignment.contractPartyId = scope_party.id',
    );
    // The assignment alone decides visibility: no administrator branch.
    expect(sub.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)');
    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', MEMBER_PARAMS);
  });

  it('adds Company Administrator oversight only when asked, checked against the stored role', async () => {
    await repository.searchPage(OVERSIGHT);

    expect(sub.andWhere).toHaveBeenCalledWith(
      '(EXISTS (SELECT 1) OR scope_member.companyRole = :__scopeAdminRole)',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', {
      ...MEMBER_PARAMS,
      __scopeAdminRole: 'Company Administrator',
    });
  });

  it('applies the visibility restriction when loading one contract', async () => {
    await repository.findById(MEMBER, 'c-1');

    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', MEMBER_PARAMS);
    expect(qb.andWhere).toHaveBeenCalledWith('contract.id = :id', {
      id: 'c-1',
    });
  });

  it('escapes search wildcards and pages the result', async () => {
    await repository.searchPage(
      MEMBER,
      { search: '50%_', skip: 5, take: 5 },
    );

    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      search: '%50\\%\\_%',
    });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('maps archived-contract creator filtering to the declared creator column', async () => {
    await repository.searchPage(
      MEMBER,
      { includeDeleted: true, creatorCompanyId: 'co-1' },
    );

    const creatorColumn = getMetadataArgsStorage().columns.find(
      ({ target, propertyName }) =>
        target === Contract && propertyName === 'createdByCompanyId',
    );
    const creatorRelation = getMetadataArgsStorage().relations.find(
      ({ target, propertyName }) =>
        target === Contract && propertyName === 'createdByCompany',
    );
    expect(creatorColumn?.options.name).toBe('created_by_company_id');
    expect(creatorColumn?.options.nullable).toBe(true);
    expect(creatorRelation?.options).toEqual(
      expect.objectContaining({ nullable: true, onDelete: 'RESTRICT' }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'contract.createdByCompanyId = :creatorCompanyId',
      { creatorCompanyId: 'co-1' },
    );
    expect(sub.andWhere).toHaveBeenCalledWith(
      'scope_party.companyId = :__scopeCompanyId',
    );
  });

  it('refuses a blank company or member scope', async () => {
    await expect(
      repository.searchPage({ ...MEMBER, companyId: ' ' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      repository.findById({ ...MEMBER, companyUserId: '' }, 'c-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
