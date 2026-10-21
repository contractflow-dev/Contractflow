import type {
  EContractStatus,
  EContractType,
  EFromStatus,
  EPartyType,
  EToStatus,
} from "@contractflow/contracts-schema";
import { api } from "./api";

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  contractType: EContractType;
  status: EContractStatus;
  parentContractId: string | null;
  originalValueMinor: number | string;
  currentValueMinor: number | string;
  currencyCode: string;
  retentionRateBps: number;
  advancePaymentRateBps: number;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor: number | string;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate: string;
  actualCompletionDate: string;
  defectsLiabilityDays: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ContractFilterParams {
  status?: EContractStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ContractPartySummary {
  id: string;
  companyId: string;
  companyName: string;
  partyType: EPartyType;
  signedAt: string | null;
}

export interface ContractMembership {
  id: string;
  companyId: string;
  partyType: EPartyType;
  signedAt: string | null;
}

export interface ContractDetail {
  contract: Contract;
  membership: ContractMembership;
}

export interface ContractStatusHistory {
  id: string;
  contractId: string;
  fromStatus: EFromStatus;
  toStatus: EToStatus;
  reason: string;
  changedById: string;
  changedAt: string;
}

export interface CompanyContractQuery extends ContractFilterParams {
  companyId: string;
}

export interface CompanyContractDetailQuery {
  companyId: string;
  contractId: string;
}

export interface CompanyContractHistoryQuery
  extends CompanyContractDetailQuery {
  page?: number;
  limit?: number;
}

function contractsUrl(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/contracts`;
}

export const contractApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getContracts: builder.query<ContractPage<Contract>, CompanyContractQuery>({
      query: ({ companyId, ...params }) => ({
        url: contractsUrl(companyId),
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({
                type: "Contract" as const,
                id,
              })),
              { type: "Contract", id: "LIST" },
            ]
          : [{ type: "Contract", id: "LIST" }],
    }),

    getContractById: builder.query<ContractDetail, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}`,
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    getContractParties: builder.query<
      ContractPartySummary[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/parties`,
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    getContractStatusHistory: builder.query<
      ContractPage<ContractStatusHistory>,
      CompanyContractHistoryQuery
    >({
      query: ({ companyId, contractId, page, limit }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/status-history`,
        params: { page, limit },
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetContractsQuery,
  useGetContractByIdQuery,
  useGetContractPartiesQuery,
  useGetContractStatusHistoryQuery,
} = contractApi;
