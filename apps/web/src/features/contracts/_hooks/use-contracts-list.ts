"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  EContractSortField,
  EContractStatus,
  ESortOrder,
} from "@contractflow/contracts-schema";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useGetContractsQuery } from "@/services/contractApi";

export const contractSortOptions = [
  {
    value: "newest",
    label: "Newest first",
    sortBy: EContractSortField.CREATED_AT,
    sortOrder: ESortOrder.DESC,
  },
  {
    value: "oldest",
    label: "Oldest first",
    sortBy: EContractSortField.CREATED_AT,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "reference",
    label: "Reference (A–Z)",
    sortBy: EContractSortField.REFERENCE_NUMBER,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "reference-desc",
    label: "Reference (Z–A)",
    sortBy: EContractSortField.REFERENCE_NUMBER,
    sortOrder: ESortOrder.DESC,
  },
  {
    value: "title",
    label: "Title (A–Z)",
    sortBy: EContractSortField.TITLE,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "title-desc",
    label: "Title (Z–A)",
    sortBy: EContractSortField.TITLE,
    sortOrder: ESortOrder.DESC,
  },
  // The API orders statuses by lifecycle: draft, active, suspended, completed.
  {
    value: "status",
    label: "Status (draft to completed)",
    sortBy: EContractSortField.STATUS,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "status-desc",
    label: "Status (completed to draft)",
    sortBy: EContractSortField.STATUS,
    sortOrder: ESortOrder.DESC,
  },
  {
    value: "start-date",
    label: "Start date (earliest)",
    sortBy: EContractSortField.START_DATE,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "start-date-latest",
    label: "Start date (latest)",
    sortBy: EContractSortField.START_DATE,
    sortOrder: ESortOrder.DESC,
  },
  {
    value: "end-date",
    label: "End date (soonest)",
    sortBy: EContractSortField.END_DATE,
    sortOrder: ESortOrder.ASC,
  },
  {
    value: "end-date-latest",
    label: "End date (latest)",
    sortBy: EContractSortField.END_DATE,
    sortOrder: ESortOrder.DESC,
  },
] as const;

type ContractSortValue = (typeof contractSortOptions)[number]["value"];

/** The sort option for a column and direction, if the API offers it. */
function sortOptionFor(sortBy: EContractSortField, sortOrder: ESortOrder) {
  return contractSortOptions.find(
    (option) => option.sortBy === sortBy && option.sortOrder === sortOrder,
  );
}

/**
 * The contract register's server-side query: search, status, archived
 * contracts, sort and page. `canViewArchived` is the server's
 * canManageCompany; the API also refuses archived contracts to others.
 */
export function useContractsList(
  companyId: string,
  {
    canViewArchived,
    assignedToMe = false,
  }: {
    canViewArchived: boolean;
    /** Only contracts the signed-in user holds a role on (My contracts). */
    assignedToMe?: boolean;
  },
) {
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatusValue] = useState<EContractStatus | "">("");
  const [includeDeletedValue, setIncludeDeletedValue] = useState(false);
  const includeDeleted = canViewArchived && includeDeletedValue;
  const [sort, setSortValue] = useState<ContractSortValue>("newest");
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  // Search applies once typing pauses, like the team list, or at once on
  // Enter or "Clear filters". A new term restarts at page 1 in the same
  // render, so the old page is never fetched for it.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [lastDebounced, setLastDebounced] = useState(debouncedSearch);
  if (lastDebounced !== debouncedSearch) {
    // Only a new pause applies; a stale value never undoes Enter or Clear.
    setLastDebounced(debouncedSearch);
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      resetPage();
    }
  }
  const sortOption =
    contractSortOptions.find((option) => option.value === sort) ??
    contractSortOptions[0];
  const query = useGetContractsQuery({
    companyId,
    search: search || undefined,
    status: status || undefined,
    includeDeleted,
    assignedToMe: assignedToMe || undefined,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
    page,
    limit,
  });
  useKeepPageInRange(query.currentData?.meta, setPage);

  // Enter applies the search straight away instead of waiting for the pause.
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchInput.trim();
    if (term !== search) {
      setSearch(term);
      resetPage();
    }
  }

  const hasFilters = Boolean(search || status || includeDeleted);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatusValue("");
    setIncludeDeletedValue(false);
    resetPage();
  }

  function setStatus(value: EContractStatus | "") {
    setStatusValue(value);
    resetPage();
  }

  function setIncludeDeleted(value: boolean) {
    setIncludeDeletedValue(value);
    resetPage();
  }

  function clearSearch() {
    setSearchInput("");
    if (search) {
      setSearch("");
      resetPage();
    }
  }

  /**
   * For a sortable column header: sorts by that column ascending, or flips
   * the direction when the table is already sorted by it.
   */
  function toggleSort(sortBy: EContractSortField) {
    const sortOrder =
      sortOption.sortBy === sortBy && sortOption.sortOrder === ESortOrder.ASC
        ? ESortOrder.DESC
        : ESortOrder.ASC;
    const option = sortOptionFor(sortBy, sortOrder);
    if (!option) return;
    setSortValue(option.value);
    resetPage();
  }

  function setSort(value: string) {
    const option = contractSortOptions.find(
      (candidate) => candidate.value === value,
    );
    if (!option) return;
    setSortValue(option.value);
    resetPage();
  }

  return {
    ...query,
    searchInput,
    setSearchInput,
    status,
    setStatus,
    includeDeleted,
    setIncludeDeleted,
    sort,
    setSort,
    /** The column and direction the results are sorted by. */
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
    toggleSort,
    page,
    setPage,
    limit,
    setLimit,
    submitSearch,
    clearSearch,
    /** The search the current results are for (after the typing pause). */
    search,
    hasFilters,
    clearFilters,
  };
}
