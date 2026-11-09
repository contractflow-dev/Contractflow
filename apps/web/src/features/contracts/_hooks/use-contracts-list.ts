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
    value: "title",
    label: "Title (A–Z)",
    sortBy: EContractSortField.TITLE,
    sortOrder: ESortOrder.ASC,
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
    page,
    setPage,
    limit,
    setLimit,
    submitSearch,
    /** The search the current results are for (after the typing pause). */
    search,
    hasFilters,
    clearFilters,
  };
}
