import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { CompanyScopedRepository } from './company-scoped.repository';
import type { ICompanyScope } from './company-scope.interface';

interface Item {
  id: string;
  companyId: string;
  label: string;
}

class ItemRepository extends CompanyScopedRepository<Item, ICompanyScope> {}

describe('CompanyScopedRepository writes', () => {
  it('overrides caller-provided company IDs for saves and batch saves', async () => {
    const saved: Item[] = [];
    const fake = {
      create: (item: Item) => item,
      save: vi.fn(async (items: Item | Item[]) => {
        const values = Array.isArray(items) ? items : [items];
        saved.push(...values);
        return items;
      }),
    };
    const repository = new ItemRepository(
      fake as unknown as Repository<Item>,
    );

    await repository.save(
      { companyId: 'company-a' },
      { id: '', companyId: 'company-b', label: 'single' },
    );
    await repository.saveMany(
      { companyId: 'company-a' },
      [{ id: '', companyId: 'company-b', label: 'batch' }],
    );

    expect(saved).toEqual([
      { id: '', companyId: 'company-a', label: 'single' },
      { id: '', companyId: 'company-a', label: 'batch' },
    ]);
  });
});
