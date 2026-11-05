"use client";

import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import {
  useGetContractByIdQuery,
  useGetContractPartiesQuery,
  useGetContractStatusHistoryQuery,
} from "@/services/contractApi";

interface ContractDetailsQuery {
  companyId: string;
  contractId: string;
}

const historyPageSize = 10;

export function useContractDetails(query: ContractDetailsQuery) {
  const contract = useGetContractByIdQuery(query);
  const parties = useGetContractPartiesQuery(query);
  const historyPagination = usePagination(historyPageSize);
  const history = useGetContractStatusHistoryQuery({
    ...query,
    page: historyPagination.page,
    limit: historyPagination.limit,
  });
  useKeepPageInRange(history.currentData?.meta, historyPagination.setPage);

  return {
    detail: contract.currentData,
    error: contract.error,
    isLoading: contract.isLoading,
    refetch: contract.refetch,
    parties: parties.currentData,
    partiesError: parties.error,
    partiesLoading: parties.isLoading,
    history: history.currentData,
    historyError: history.error,
    historyLoading:
      history.isLoading || (history.isFetching && !history.currentData),
    historyFetching: history.isFetching,
    setHistoryPage: historyPagination.setPage,
    setHistoryPageSize: historyPagination.setLimit,
  };
}
