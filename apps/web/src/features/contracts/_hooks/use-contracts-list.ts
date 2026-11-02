"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  EContractSortField,
  EContractStatus,
  ESortOrder,
} from "@contractflow/contracts-schema";
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
    value: "end-date",
    label: "End date (soonest)",
    sortBy: EContractSortField.END_DATE,
    sortOrder: ESortOrder.ASC,
  },
] as const;

type ContractSortValue = (typeof contractSortOptions)[number]["value"];

export function useContractsList(companyId: string) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatusValue] = useState<EContractStatus | "">("");
  const [includeDeleted, setIncludeDeletedValue] = useState(false);
  const [sort, setSortValue] = useState<ContractSortValue>("newest");
  const { page, limit, setPage, setLimit, resetPage } = usePagination();
  const sortOption =
    contractSortOptions.find((option) => option.value === sort) ??
    contractSortOptions[0];
  const query = useGetContractsQuery({
    companyId,
    search: search || undefined,
    status: status || undefined,
    includeDeleted,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
    page,
    limit,
  });
  useKeepPageInRange(query.currentData?.meta, setPage);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
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
  };
}
