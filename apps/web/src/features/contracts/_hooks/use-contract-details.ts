"use client";

import {
  useGetContractByIdQuery,
  useGetContractPartiesQuery,
  useGetContractStatusHistoryQuery,
} from "@/services/contractApi";

interface ContractDetailsQuery {
  companyId: string;
  contractId: string;
}

export function useContractDetails(query: ContractDetailsQuery) {
  const contract = useGetContractByIdQuery(query);
  const parties = useGetContractPartiesQuery(query);
  const history = useGetContractStatusHistoryQuery({
    ...query,
    page: 1,
    limit: 50,
  });

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
    historyLoading: history.isLoading,
  };
}
