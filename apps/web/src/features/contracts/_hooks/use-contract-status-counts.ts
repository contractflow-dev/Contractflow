"use client";

import { EContractStatus } from "@contractflow/contracts-schema";
import { useGetContractsQuery } from "@/services/contractApi";

/** The register's predefined status filters, in display order. "" is all. */
export const CONTRACT_STATUS_FILTERS = [
  "",
  EContractStatus.ACTIVE,
  EContractStatus.DRAFT,
  EContractStatus.SUSPENDED,
  EContractStatus.COMPLETED,
] as const;

export type ContractStatusFilter = (typeof CONTRACT_STATUS_FILTERS)[number];

/**
 * How many contracts each status filter would show, from the API: each is the
 * `meta.totalItems` of a one-row request with the list's own search, archived
 * setting and scope, so it covers exactly what the server would list and
 * nothing the reader can't see. A count is undefined until its answer
 * arrives (or if it fails), and is then left out rather than guessed.
 */
export function useContractStatusCounts(
  companyId: string,
  {
    search,
    includeDeleted,
    assignedToMe = false,
  }: {
    /** The search the list applies (after the typing pause). */
    search: string;
    includeDeleted: boolean;
    assignedToMe?: boolean;
  },
): Record<ContractStatusFilter, number | undefined> {
  const base = {
    companyId,
    search: search || undefined,
    includeDeleted,
    assignedToMe: assignedToMe || undefined,
    page: 1,
    limit: 1,
  };
  const all = useGetContractsQuery(base);
  const active = useGetContractsQuery({
    ...base,
    status: EContractStatus.ACTIVE,
  });
  const draft = useGetContractsQuery({
    ...base,
    status: EContractStatus.DRAFT,
  });
  const suspended = useGetContractsQuery({
    ...base,
    status: EContractStatus.SUSPENDED,
  });
  const completed = useGetContractsQuery({
    ...base,
    status: EContractStatus.COMPLETED,
  });
  return {
    "": all.currentData?.meta.totalItems,
    [EContractStatus.ACTIVE]: active.currentData?.meta.totalItems,
    [EContractStatus.DRAFT]: draft.currentData?.meta.totalItems,
    [EContractStatus.SUSPENDED]: suspended.currentData?.meta.totalItems,
    [EContractStatus.COMPLETED]: completed.currentData?.meta.totalItems,
  };
}
