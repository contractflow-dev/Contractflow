import { pageOffset, toPaginatedResponse } from './pagination';
import { describe, expect, it } from 'vitest';

describe('pagination helpers', () => {
  it('computes the row offset for a page', () => {
    expect(pageOffset({ page: 1, limit: 20 })).toBe(0);
    expect(pageOffset({ page: 4, limit: 25 })).toBe(75);
  });

  it('describes a full page', () => {
    expect(
      toPaginatedResponse(
        { items: ['a', 'b'], total: 5 },
        { page: 1, limit: 2 },
      ),
    ).toEqual({
      data: ['a', 'b'],
      meta: {
        totalItems: 5,
        itemCount: 2,
        itemsPerPage: 2,
        totalPages: 3,
        currentPage: 1,
      },
    });
  });

  it('describes a partial last page', () => {
    expect(
      toPaginatedResponse({ items: ['e'], total: 5 }, { page: 3, limit: 2 })
        .meta,
    ).toMatchObject({ itemCount: 1, totalPages: 3, currentPage: 3 });
  });

  it('describes an empty collection', () => {
    expect(
      toPaginatedResponse({ items: [], total: 0 }, { page: 1, limit: 20 }),
    ).toEqual({
      data: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 20,
        totalPages: 0,
        currentPage: 1,
      },
    });
  });
});
