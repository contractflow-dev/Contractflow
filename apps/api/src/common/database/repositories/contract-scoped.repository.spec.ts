import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IContractCompanyScope,
  IContractScopedEntity,
} from './contract-scope.interface';
import { ContractScopedRepository } from './contract-scoped.repository';

interface Item extends IContractScopedEntity {
  ownerCompanyId: string;
  title: string;
}

type Where = Record<string, unknown>;

class ItemRepository extends ContractScopedRepository<Item, IContractCompanyScope> {
  protected override readonly requireCompany = true;
  protected override readonly companyProperty = 'ownerCompanyId';
}

const matches = (row: Where, where: Where) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

describe('ContractScopedRepository writes', () => {
  let rows: Item[];
  let repository: ItemRepository;
  const scope = { contractId: 'c1', companyId: 'co1' };

  beforeEach(() => {
    rows = [
      { id: 'a', contractId: 'c1', ownerCompanyId: 'co1', title: 'mine' },
      { id: 'b', contractId: 'c2', ownerCompanyId: 'co1', title: 'other contract' },
      { id: 'c', contractId: 'c1', ownerCompanyId: 'co2', title: 'other company' },
    ];
    const fake = {
      manager: {
        getRepository: () => ({
          exists: async ({ where }: { where: Where }) =>
            matches({ contractId: 'c1', companyId: 'co1' }, where) ||
            matches({ contractId: 'c1', companyId: 'co2' }, where),
        }),
      },
      findOne: async ({ where }: { where: Where }) =>
        rows.find((row) => matches(row, where)) ?? null,
      update: vi.fn(async (where: Where, data: Where) => {
        const targets = rows.filter((row) => matches(row, where));
        targets.forEach((row) => Object.assign(row, data));
        return { affected: targets.length };
      }),
      delete: vi.fn(async (where: Where) => {
        const targets = rows.filter((row) => matches(row, where));
        rows = rows.filter((row) => !targets.includes(row));
        return { affected: targets.length };
      }),
    };
    repository = new ItemRepository(fake as unknown as Repository<Item>);
  });

  it('updates a record only inside the contract and company scope', async () => {
    await expect(
      repository.update('a', { title: 'renamed', contractId: 'c9' }, scope),
    ).resolves.toMatchObject({ title: 'renamed', contractId: 'c1' });

    await expect(
      repository.update('b', { title: 'hijack' }, scope),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.update('c', { title: 'hijack' }, scope),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rows.map((row) => row.title)).toEqual([
      'renamed',
      'other contract',
      'other company',
    ]);
  });

  it('deletes a record only inside the contract and company scope', async () => {
    await expect(repository.delete('b', scope)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(repository.delete('c', scope)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rows).toHaveLength(3);

    await repository.delete('a', scope);
    expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('requires a company when the repository demands one', async () => {
    await expect(
      repository.findById('a', { contractId: 'c1' } as IContractCompanyScope),
    ).rejects.toThrow('Company context is required');
  });
});
