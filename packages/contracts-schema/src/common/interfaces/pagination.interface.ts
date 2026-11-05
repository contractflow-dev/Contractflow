import type { ESortOrder } from "../enums/pagination.enum.js";

/** Offset pagination request. Omitted values use the API defaults. */
export interface IPaginationQuery {
  page?: number;
  limit?: number;
}

/** Sort request. `sortBy` is validated against an endpoint-specific allowlist. */
export interface ISortQuery<TSortField extends string> {
  sortBy?: TSortField;
  sortOrder?: ESortOrder;
}

export interface IPaginationMeta {
  /** Records matching the authorized scope and filters, across all pages. */
  totalItems: number;
  /** Records on this page. */
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface IPaginatedResponse<T> {
  data: T[];
  meta: IPaginationMeta;
}
