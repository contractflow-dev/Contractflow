import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { ContractStatusHistoryRepository } from './contract-status-history.repository';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const matches = (row: Row, where: Where | Where[] | undefined): boolean => {
  if (!where) return true;
  const options = Array.isArray(where) ? where : [where];
  return options.some((w) =>
    Object.entries(w).every(([key, value]) => row[key] === value),
  );
};

function createFakeRepository(rows: Row[], parties: Row[]) {
  const fake = {
    manager: {
      getRepository: () => ({
        exists: vi.fn(async ({ where }: { where: Where }) =>
          parties.some((party) => matches(party, where)),
        ),
      }),
    },
    findOne: vi.fn(async ({ where }: { where: Where }) =>
      rows.find((row) => matches(row, where)) ?? null,
    ),
    find: vi.fn(async ({ where }: { where: Where }) =>
      rows.filter((row) => matches(row, where)),
    ),
    findAndCount: vi.fn(async ({ where }: { where: Where }) => {
      const items = rows.filter((row) => matches(row, where));
      return [items, items.length];
    }),
    count: vi.fn(async ({ where }: { where: Where }) =>
      rows.filter((row) => matches(row, where)).length,
    ),
    update: vi.fn(async (where: Where, data: Row) => {
      const targets = rows.filter((row) => matches(row, where));
      targets.forEach((row) => Object.assign(row, data));
      return { affected: targets.length };
    }),
    delete: vi.fn(async (where: Where) => {
      const targets = rows.filter((row) => matches(row, where));
      targets.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { affected: targets.length };
    }),
    create: vi.fn((data: Row) => ({ ...data })),
    save: vi.fn(async (entity: Row) => {
      const saved = { id: `new-${rows.length}`, ...entity };
      rows.push(saved);
      return saved;
    }),
    createQueryBuilder: vi.fn(),
  };
  return fake;
}

describe('ContractStatusHistoryRepository contract scope', () => {
  let rows: Row[];
  let parties: Row[];
  let fake: ReturnType<typeof createFakeRepository>;
  let repository: ContractStatusHistoryRepository;
  const scope = { contractId: 'contract-1' };
  const companyScope = { contractId: 'contract-1', companyId: 'client-1' };

  beforeEach(() => {
    rows = [
      { id: 'h1', contractId: 'contract-1', reason: 'kickoff' },
      { id: 'h2', contractId: 'contract-2', reason: 'other contract' },
    ];
    parties = [
      { contractId: 'contract-1', companyId: 'client-1' },
      { contractId: 'contract-1', companyId: 'contractor-1' },
      { contractId: 'contract-2', companyId: 'client-2' },
    ];
    fake = createFakeRepository(rows, parties);
    repository = new ContractStatusHistoryRepository(
      fake as unknown as Repository<ContractStatusHistory>,
    );
  });

  it('finds a record that belongs to the contract', async () => {
    await expect(repository.findById('h1', scope)).resolves.toMatchObject({
      id: 'h1',
    });
  });

  it('does not return a record from another contract or a missing record', async () => {
    await expect(repository.findById('h2', scope)).resolves.toBeNull();
    await expect(repository.findById('missing', scope)).resolves.toBeNull();
  });

  it('keeps extra filters from overriding the contract scope', async () => {
    const found = await repository.findOne(
      { where: { contractId: 'contract-2' } },
      scope,
    );
    expect(found?.id).not.toBe('h2');
    expect(found?.contractId).toBe('contract-1');
    await expect(
      repository.findOne({ where: { id: 'h2', contractId: 'contract-2' } }, scope),
    ).resolves.toBeNull();
    await expect(
      repository.findAll(scope, { where: { contractId: 'contract-2' } }),
    ).resolves.toEqual([expect.objectContaining({ id: 'h1' })]);
    await expect(
      repository.count(scope, { contractId: 'contract-2' }),
    ).resolves.toBe(1);
    await expect(
      repository.findAll(scope, {
        where: [{ contractId: 'contract-2' }, { reason: 'other contract' }],
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'h1' })]);
  });

  it('keeps lists, counts, pagination and sorting inside the contract', async () => {
    const page = await repository.findForContract(scope, { skip: 0, take: 10 });

    expect(page.items.map((item) => item.id)).toEqual(['h1']);
    expect(page.total).toBe(1);
    expect(fake.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { changedAt: 'DESC' },
        where: { contractId: 'contract-1' },
      }),
    );
    await expect(repository.count(scope)).resolves.toBe(1);
  });

  it('appends records stamped with the scoped contract', async () => {
    const saved = await repository.append(
      { reason: 'approved', contractId: 'contract-2' },
      scope,
    );

    expect(saved.contractId).toBe('contract-1');
  });

  it('refuses to save an entity that names a different contract', async () => {
    const entity = Object.assign(new ContractStatusHistory(), {
      contractId: 'contract-2',
    });

    await expect(repository.save(entity, scope)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fake.save).not.toHaveBeenCalled();
  });

  it('is append-only', async () => {
    await expect(repository.update()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(repository.delete()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a party company and rejects a non-party company', async () => {
    await expect(
      repository.findById('h1', companyScope),
    ).resolves.toMatchObject({ id: 'h1' });
    await expect(
      repository.findById('h1', { contractId: 'contract-1', companyId: 'client-2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.findAll({ contractId: 'contract-1', companyId: 'stranger' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.append(
        { reason: 'x' },
        { contractId: 'contract-1', companyId: 'stranger' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fake.save).not.toHaveBeenCalled();
  });

  it('fails safely when mandatory scope information is missing', async () => {
    const bad = [
      { contractId: '' },
      { contractId: '   ' },
      undefined,
      { contractId: 'contract-1', companyId: '' },
    ] as unknown as { contractId: string }[];

    for (const badScope of bad) {
      await expect(repository.findAll(badScope)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(repository.count(badScope)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(fake.find).not.toHaveBeenCalled();
    expect(fake.count).not.toHaveBeenCalled();
  });

  it('applies contract and party predicates to scoped query builders', async () => {
    const subQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getQuery: vi.fn().mockReturnValue('(SELECT 1)'),
    };
    const qb = {
      alias: 'history',
      andWhere: vi.fn().mockReturnThis(),
      subQuery: vi.fn().mockReturnValue(subQuery),
    };
    fake.createQueryBuilder.mockReturnValue(qb);

    await repository.createScopedQueryBuilder(companyScope, 'history');

    expect(qb.andWhere).toHaveBeenCalledWith(
      'history.contractId = :__scopeContractId',
      { __scopeContractId: 'contract-1' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('EXISTS (SELECT 1)', {
      __scopeCompanyId: 'client-1',
    });
    await expect(
      repository.createScopedQueryBuilder({
        contractId: 'contract-1',
        companyId: 'stranger',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
