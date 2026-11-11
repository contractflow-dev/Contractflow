"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE } from "@contractflow/contracts-schema";
import type { IPaginationMeta } from "@contractflow/contracts-schema";
import {
  initialPaginationState,
  pageInRange,
  withPageSize,
} from "@/lib/pagination";

/**
 * Page and page-size state for one paginated list. Pass both values to the
 * RTK Query hook so they form part of its cache key, and call `resetPage`
 * whenever a search or filter changes.
 */
export function usePagination(initialLimit?: number, initialPage?: number) {
  const [state, setState] = useState(() =>
    initialPaginationState(initialLimit, initialPage),
  );

  const setPage = useCallback((page: number) => {
    setState((current) =>
      current.page === page ? current : { ...current, page },
    );
  }, []);
  const setLimit = useCallback((limit: number) => {
    setState((current) => withPageSize(current, limit));
  }, []);
  const resetPage = useCallback(() => setPage(DEFAULT_PAGE), [setPage]);

  return { page: state.page, limit: state.limit, setPage, setLimit, resetPage };
}

/** Moves back to the last page when the current one no longer exists. */
export function useKeepPageInRange(
  meta: IPaginationMeta | undefined,
  setPage: (page: number) => void,
) {
  useEffect(() => {
    const page = pageInRange(meta);
    if (page !== null) setPage(page);
  }, [meta, setPage]);
}
