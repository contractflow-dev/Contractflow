import type {
  EContractType,
  EContractStatus,
} from '@contractflow/contracts-schema';
import { api } from './api';

export interface Contract {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  contractType: EContractType;
  status: EContractStatus;
  parentContractId?: string;
  originalValueMinor: number;
  currentValueMinor: number;
  currencyCode: string;
  retentionRateBps?: number;
  advancePaymentRateBps?: number;
  paymentTermsDays?: number;
  liquidatedDamagesPerDayMinor?: number;
  awardDate?: string;
  startDate?: string;
  endDate?: string;
  revisedEndDate?: string;
  actualCompletionDate?: string;
  defectsLiabilityDays?: number;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractFilterParams {
  status?: EContractStatus;
  contractType?: EContractType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateContractRequest {
  referenceNumber: string;
  title: string;
  description?: string;
  contractType: EContractType;
  status?: EContractStatus;
  parentContractId?: string;
  originalValueMinor: number;
  currentValueMinor?: number;
  currencyCode: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

export interface UpdateContractRequest {
  id: string;
  title?: string;
  description?: string;
  status?: EContractStatus;
  currentValueMinor?: number;
  revisedEndDate?: string;
  actualCompletionDate?: string;
}

export const contractApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getContracts: builder.query<Contract[], ContractFilterParams | void>({
      query: (params) => ({
        url: '/contract',
        params: params || undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Contract' as const, id })),
              { type: 'Contract', id: 'LIST' },
            ]
          : [{ type: 'Contract', id: 'LIST' }],
    }),

    getContractById: builder.query<Contract, string>({
      query: (id) => ({
        url: `/contract/${id}`,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Contract', id }],
    }),

    createContract: builder.mutation<Contract, CreateContractRequest>({
      query: (data) => ({
        url: '/contract',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Contract', id: 'LIST' }],
    }),

    updateContract: builder.mutation<Contract, UpdateContractRequest>({
      query: ({ id, ...patch }) => ({
        url: `/contract/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Contract', id },
        { type: 'Contract', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetContractsQuery,
  useGetContractByIdQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
} = contractApi;
