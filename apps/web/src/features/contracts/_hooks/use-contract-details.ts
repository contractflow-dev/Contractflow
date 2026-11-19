"use client";

import { useState } from "react";
import type { EContractStatus } from "@contractflow/contracts-schema";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { dayBoundsInTimeZone } from "@/lib/format";
import {
  useGetContractByIdQuery,
  useGetContractPartiesQuery,
  useGetContractStatusHistoryQuery,
} from "@/services/contractApi";

interface ContractDetailsQuery {
  companyId: string;
  contractId: string;
}

/**
 * The status history's filters as the controls hold them: a status the change
 * went to or from, and calendar days in the viewer's time zone.
 */
export interface StatusHistoryFilters {
  status: EContractStatus | "";
  fromDay: string;
  toDay: string;
}

export const NO_STATUS_HISTORY_FILTERS: StatusHistoryFilters = {
  status: "",
  fromDay: "",
  toDay: "",
};

const historyPageSize = 10;

/**
 * The API's status-history filters for the controls' values. Days become the
 * first and last instant of that day in the viewer's time zone, as the
 * activity timeline does. An end day before the start day is reported
 * instead of sent, so the API never sees a range it refuses.
 */
export function toStatusHistoryQuery(
  filters: StatusHistoryFilters,
  timeZone: string | undefined,
): {
  status?: EContractStatus;
  fromDate?: string;
  toDate?: string;
  rangeError: string | null;
} {
  const from = filters.fromDay
    ? dayBoundsInTimeZone(filters.fromDay, timeZone)
    : null;
  const to = filters.toDay
    ? dayBoundsInTimeZone(filters.toDay, timeZone)
    : null;
  const rangeError =
    from && to && from.start > to.end
      ? "The end date is before the start date."
      : null;
  return {
    status: filters.status || undefined,
    fromDate: rangeError ? undefined : from?.start,
    toDate: rangeError ? undefined : to?.end,
    rangeError,
  };
}

export function useContractDetails(
  query: ContractDetailsQuery,
  { timeZone }: { timeZone?: string } = {},
) {
  const contract = useGetContractByIdQuery(query);
  const parties = useGetContractPartiesQuery(query);
  const historyPagination = usePagination(historyPageSize);
  const [historyFilters, setHistoryFilterValues] = useState(
    NO_STATUS_HISTORY_FILTERS,
  );
  const { rangeError, ...historyQuery } = toStatusHistoryQuery(
    historyFilters,
    timeZone,
  );
  const history = useGetContractStatusHistoryQuery({
    ...query,
    ...historyQuery,
    page: historyPagination.page,
    limit: historyPagination.limit,
  });
  useKeepPageInRange(history.currentData?.meta, historyPagination.setPage);

  /** Changes some filters; the results start again at page 1. */
  function setHistoryFilters(patch: Partial<StatusHistoryFilters>) {
    setHistoryFilterValues((current) => ({ ...current, ...patch }));
    historyPagination.resetPage();
  }

  return {
    detail: contract.currentData,
    error: contract.error,
    isLoading: contract.isLoading,
    refetch: contract.refetch,
    parties: parties.currentData,
    partiesError: parties.error,
    partiesLoading: parties.isLoading,
    refetchParties: parties.refetch,
    history: history.currentData,
    historyError: history.error,
    historyLoading:
      history.isLoading || (history.isFetching && !history.currentData),
    historyFetching: history.isFetching,
    refetchHistory: history.refetch,
    setHistoryPage: historyPagination.setPage,
    setHistoryPageSize: historyPagination.setLimit,
    historyFilters,
    historyRangeError: rangeError,
    setHistoryFilters,
    clearHistoryFilters: () => setHistoryFilters(NO_STATUS_HISTORY_FILTERS),
  };
}
