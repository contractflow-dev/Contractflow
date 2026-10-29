import { CursorPage, Page } from "./pagination.interface.js";
import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

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


paginate(
    scope: Scope,
    params?: PaginationParams,
    options?: Omit<FindManyOptions<T>, 'skip' | 'take'>,
  ): Promise<Page<T>>;

  paginateByCursor(
    scope: Scope,
    params?: CursorParams,
    options?: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'>,
  ): Promise<CursorPage<T>>;
/** Page-based pagination with a clamped page size. */
  async paginate(
    scope: Scope,
    params: PaginationParams = {},
    options: Omit<FindManyOptions<T>, 'skip' | 'take'> = {},
  ): Promise<Page<T>> {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(params.limit ?? DEFAULT_PAGE_SIZE)),
    );

    const { items, total } = await this.findPage(scope, {
      ...options,
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
    };
  }

  /**
   * Keyset pagination on `id`. Relies on ids being time-sortable (ULID),
   * so results are ordered by creation time without OFFSET or a count query.
   * Any `order` in `options` is ignored; `id` ordering is required for the cursor.
   */
  async paginateByCursor(
    scope: Scope,
    params: CursorParams = {},
    options: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'> = {},
  ): Promise<CursorPage<T>> {
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(params.limit ?? DEFAULT_PAGE_SIZE)),
    );
    const direction = params.direction ?? 'desc';
    const { cursor } = params;

    const scoped = this.withScope(scope, options.where as FindOptionsWhere<T>);
    const cursorCondition = cursor
      ? { id: direction === 'desc' ? LessThan(cursor) : MoreThan(cursor) }
      : {};
    const where = Array.isArray(scoped)
      ? scoped.map((w) => ({ ...w, ...cursorCondition }) as FindOptionsWhere<T>)
      : ({ ...scoped, ...cursorCondition } as FindOptionsWhere<T>);

    // Fetch one extra row to learn whether another page exists.
    const rows = await this.repository.find({
      ...options,
      where,
      order: { id: direction.toUpperCase() } as FindOptionsOrder<T>,
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasNext ? items[items.length - 1].id : null,
      hasNext,
    };
  }

    /** Page-based pagination with a clamped page size. */
  async paginate(
    scope: Scope,
    params: PaginationParams = {},
    options: Omit<FindManyOptions<T>, 'skip' | 'take'> = {},
  ): Promise<Page<T>> {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(params.limit ?? DEFAULT_PAGE_SIZE)),
    );

    const { items, total } = await this.findPage(scope, {
      ...options,
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
    };
  }

  /**
   * Keyset pagination on `id`. Relies on ids being time-sortable (ULID),
   * so results are ordered by creation time without OFFSET or a count query.
   * Any `order` in `options` is ignored; `id` ordering is required for the cursor.
   */
  async paginateByCursor(
    scope: Scope,
    params: CursorParams = {},
    options: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'> = {},
  ): Promise<CursorPage<T>> {
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(params.limit ?? DEFAULT_PAGE_SIZE)),
    );
    const direction = params.direction ?? 'desc';
    const { cursor } = params;

    const scoped = this.withScope(scope, options.where as FindOptionsWhere<T>);
    const cursorCondition = cursor
      ? { id: direction === 'desc' ? LessThan(cursor) : MoreThan(cursor) }
      : {};
    const where = Array.isArray(scoped)
      ? scoped.map((w) => ({ ...w, ...cursorCondition }) as FindOptionsWhere<T>)
      : ({ ...scoped, ...cursorCondition } as FindOptionsWhere<T>);

    // Fetch one extra row to learn whether another page exists.
    const rows = await this.repository.find({
      ...options,
      where,
      order: { id: direction.toUpperCase() } as FindOptionsOrder<T>,
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasNext ? items[items.length - 1].id : null,
      hasNext,
    };
  }

  paginate(
    scope: Scope,
    params?: PaginationParams,
    options?: Omit<FindManyOptions<T>, 'skip' | 'take'>,
  ): Promise<Page<T>>;

  paginateByCursor(
    scope: Scope,
    params?: CursorParams,
    options?: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'>,
  ): Promise<CursorPage<T>>;