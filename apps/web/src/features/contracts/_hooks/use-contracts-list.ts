"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { EContractStatus } from "@contractflow/contracts-schema";
import { useGetContractsQuery } from "@/services/contractApi";

export function useContractsList(companyId: string, pageSize: number) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EContractStatus | "">("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const query = useGetContractsQuery({
    companyId,
    search: search || undefined,
    status: status || undefined,
    includeDeleted,
    page,
    limit: pageSize,
  });
  const pageCount = Math.max(
    1,
    Math.ceil((query.currentData?.total ?? 0) / pageSize),
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return {
    ...query,
    searchInput,
    setSearchInput,
    status,
    setStatus,
    includeDeleted,
    setIncludeDeleted,
    page,
    setPage,
    pageCount,
    submitSearch,
  };
}
