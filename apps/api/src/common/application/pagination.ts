import type { IPaginatedResponse } from '@contractflow/contracts-schema';
import type { IPageQuery, IPersistencePage } from './pagination.interface';

/** Rows to skip for a page. Pages and limits are validated as positive. */
export function pageOffset(query: IPageQuery): number {
  return (query.page - 1) * query.limit;
}

/**
 * Builds the API page envelope. `total` must come from the same scoped and
 * filtered query as `items`, so metadata never counts unauthorized rows.
 */
export function toPaginatedResponse<Item>(
  page: IPersistencePage<Item>,
  query: IPageQuery,
): IPaginatedResponse<Item> {
  return {
    data: page.items,
    meta: {
      totalItems: page.total,
      itemCount: page.items.length,
      itemsPerPage: query.limit,
      totalPages: Math.ceil(page.total / query.limit),
      currentPage: query.page,
    },
  };
}
