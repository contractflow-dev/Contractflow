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
  deletedAt?: Date | null;
}

type Where = Record<string, unknown>;

class ItemRepository extends ContractScopedRepository<
  Item,
  IContractCompanyScope
> {
  protected override readonly requireCompany = true;
  protected override readonly companyProperty = 'ownerCompanyId';
}

const matches = (row: Where, where: Where) =>
  Object.entries(where).every(([key, value]) => {
    if (key === 'id' && typeof value === 'object' && value !== null) {
      return true;
    }
    return row[key] === value;
  });

describe('ContractScopedRepository writes', () => {
  let rows: Item[];
  let repository: ItemRepository;
  const scope = { contractId: 'c1', companyId: 'co1' };

  beforeEach(() => {
    rows = [
      { id: 'a', contractId: 'c1', ownerCompanyId: 'co1', title: 'mine' },
      {
        id: 'b',
        contractId: 'c2',
        ownerCompanyId: 'co1',
        title: 'other contract',
      },
      {
        id: 'c',
        contractId: 'c1',
        ownerCompanyId: 'co2',
        title: 'other company',
      },
    ];
    const fake = {
      manager: {
        getRepository: () => ({
          exists: async ({ where }: { where: Where }) =>
            matches({ contractId: 'c1', companyId: 'co1' }, where) ||
            matches({ contractId: 'c1', companyId: 'co2' }, where),
        }),
        transaction: async <T>(
          callback: (manager: { save: (entities: Item[]) => Promise<Item[]> }) => Promise<T>,
        ) =>
          callback({
            save: async (entities) => {
              rows.push(...entities);
              return entities;
            },
          }),
      },
      create: (entity: Item) => entity,
      save: async (entity: Item) => {
        rows.push(entity);
        return entity;
      },
      find: async ({ where }: { where: Where }) =>
        rows.filter((row) => matches(row, where)),
      findOne: async ({ where }: { where: Where }) =>
        rows.find((row) => matches(row, where)) ?? null,
      exists: async ({ where }: { where: Where }) =>
        rows.some((row) => matches(row, where)),
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
      softDelete: async (where: Where) => {
        const targets = rows.filter((row) => matches(row, where));
        targets.forEach((row) => {
          row.deletedAt = new Date();
        });
        return { affected: targets.length };
      },
      restore: async (where: Where) => {
        const targets = rows.filter((row) => matches(row, where));
        targets.forEach((row) => {
          row.deletedAt = null;
        });
        return { affected: targets.length };
      },
    };
    repository = new ItemRepository(fake as unknown as Repository<Item>);
  });

  it('updates a record only inside the contract and company scope', async () => {
    await expect(
      repository.update(scope, 'a', {
        title: 'renamed',
        contractId: 'c9',
      }),
    ).resolves.toMatchObject({ title: 'renamed', contractId: 'c1' });

    await expect(
      repository.update(scope, 'b', { title: 'hijack' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.update(scope, 'c', { title: 'hijack' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rows.map((row) => row.title)).toEqual([
      'renamed',
      'other contract',
      'other company',
    ]);
  });

  it('deletes a record only inside the contract and company scope', async () => {
    await expect(repository.delete(scope, 'b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(repository.delete(scope, 'c')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rows).toHaveLength(3);

    await repository.delete(scope, 'a');
    expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('requires a company when the repository demands one', async () => {
    await expect(
      repository.findById({ contractId: 'c1' } as IContractCompanyScope, 'a'),
    ).rejects.toThrow('Company context is required');
  });

  it('limits ID reads and existence checks to the authorized company and contract', async () => {
    await expect(repository.findById(scope, 'a')).resolves.toMatchObject({
      title: 'mine',
    });
    await expect(repository.findById(scope, 'b')).resolves.toBeNull();
    await expect(repository.findById(scope, 'c')).resolves.toBeNull();
    await expect(repository.findByIds(scope, ['a', 'b', 'c'])).resolves.toEqual([
      expect.objectContaining({ id: 'a' }),
    ]);
    await expect(repository.exists(scope, { id: 'a' })).resolves.toBe(true);
    await expect(repository.exists(scope, { id: 'c' })).resolves.toBe(false);
    await expect(repository.existsById(scope, 'b')).resolves.toBe(false);
  });

  it('rejects a company that is not a party to the contract', async () => {
    await expect(
      repository.findById({ contractId: 'c1', companyId: 'co3' }, 'a'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saves a batch only within the requested contract and company', async () => {
    await expect(
      repository.saveMany(scope, [
        {
          id: '',
          contractId: 'c1',
          ownerCompanyId: 'co1',
          title: 'new',
        },
      ]),
    ).resolves.toMatchObject([
      { contractId: 'c1', ownerCompanyId: 'co1', title: 'new' },
    ]);

    await expect(
      repository.saveMany(scope, [
        {
          id: '',
          contractId: 'c2',
          ownerCompanyId: 'co1',
          title: 'wrong contract',
        },
      ]),
    ).rejects.toThrow('different contract');
    await expect(
      repository.saveMany(scope, [
        {
          id: '',
          contractId: 'c1',
          ownerCompanyId: 'co2',
          title: 'wrong company',
        },
      ]),
    ).rejects.toThrow('different company');
  });

  it('scopes bulk updates and deletes', async () => {
    await expect(
      repository.updateMany(scope, { title: 'mine' }, { title: 'updated' }),
    ).resolves.toBe(1);
    expect(rows.map((row) => row.title)).toEqual([
      'updated',
      'other contract',
      'other company',
    ]);

    await expect(
      repository.deleteMany(scope, { title: 'other company' }),
    ).resolves.toBe(0);
    await expect(repository.deleteMany(scope, { title: 'updated' })).resolves.toBe(
      1,
    );
    expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('scopes soft deletes and restores', async () => {
    await repository.softDelete(scope, 'a');
    expect(rows[0].deletedAt).toBeInstanceOf(Date);
    expect(rows[2].deletedAt).toBeUndefined();

    await repository.restore(scope, 'a');
    expect(rows[0].deletedAt).toBeNull();
    expect(rows[2].deletedAt).toBeUndefined();

    await expect(repository.softDelete(scope, 'c')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(repository.restore(scope, 'b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
