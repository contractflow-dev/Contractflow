export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CursorParams {
  /** The `id` of the last item from the previous page. */
  cursor?: string;
  limit?: number;
  /** 'desc' = newest first (default), 'asc' = oldest first. */
  direction?: "asc" | "desc";
}

export interface CursorPage<T> {
  items: T[];
  /** Pass as `cursor` to fetch the next page; null when there is none. */
  nextCursor: string | null;
  hasNext: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CursorParams {
  /** The `id` of the last item from the previous page. */
  cursor?: string;
  limit?: number;
  /** 'desc' = newest first (default), 'asc' = oldest first. */
  direction?: "asc" | "desc";
}

export interface CursorPage<T> {
  items: T[];
  /** Pass as `cursor` to fetch the next page; null when there is none. */
  nextCursor: string | null;
  hasNext: boolean;
}
