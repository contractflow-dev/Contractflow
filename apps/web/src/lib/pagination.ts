import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@contractflow/contracts-schema";
import type { IPaginationMeta } from "@contractflow/contracts-schema";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].filter(
  (size) => size <= MAX_PAGE_LIMIT,
);

export interface PaginationState {
  page: number;
  limit: number;
}

export type PageRangeItem = number | "ellipsis-start" | "ellipsis-end";

export function initialPaginationState(
  limit: number = DEFAULT_PAGE_LIMIT,
  page: number = DEFAULT_PAGE,
): PaginationState {
  return { page, limit };
}

/** A new page size starts again from page 1. */
export function withPageSize(
  state: PaginationState,
  limit: number,
): PaginationState {
  return state.limit === limit && state.page === DEFAULT_PAGE
    ? state
    : { page: DEFAULT_PAGE, limit };
}

/**
 * The last valid page when `meta` reports the requested page is past the end
 * (for example after deleting the only row on the last page), else `null`.
 */
export function pageInRange(meta: IPaginationMeta | undefined): number | null {
  if (!meta || meta.totalPages === 0) return null;
  return meta.currentPage > meta.totalPages ? meta.totalPages : null;
}

/**
 * Page numbers to show: the first, the last, and `siblings` either side of the
 * current page, with ellipses for gaps of more than one page.
 */
export function getPageRange(
  currentPage: number,
  totalPages: number,
  siblings = 1,
): PageRangeItem[] {
  if (totalPages <= 0) return [];
  const start = Math.max(2, currentPage - siblings);
  const end = Math.min(totalPages - 1, currentPage + siblings);
  const range: PageRangeItem[] = [1];

  if (start > 3) range.push("ellipsis-start");
  else if (start === 3) range.push(2);
  for (let page = start; page <= end; page += 1) range.push(page);
  if (end < totalPages - 2) range.push("ellipsis-end");
  else if (end === totalPages - 2) range.push(totalPages - 1);
  if (totalPages > 1) range.push(totalPages);

  return range;
}

/** "Showing 21–40 of 150" with an empty page reported as zero. */
export function describePageWindow(meta: IPaginationMeta): {
  first: number;
  last: number;
  total: number;
} {
  if (meta.itemCount === 0) {
    return { first: 0, last: 0, total: meta.totalItems };
  }
  const first = (meta.currentPage - 1) * meta.itemsPerPage + 1;
  return {
    first,
    last: first + meta.itemCount - 1,
    total: meta.totalItems,
  };
}
