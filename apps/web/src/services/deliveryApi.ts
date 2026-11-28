import type {
  ContractProgress,
  ContractStage,
  CreateContractStageRequest,
  CreateMilestoneRequest,
  DecideMilestoneSubmissionRequest,
  IPaginatedResponse,
  IPaginationQuery,
  ListMilestonesFilters,
  Milestone,
  MilestoneDecision,
  MilestoneOutstandingItem,
  MilestoneSubmission,
  SetContractStageApplicabilityRequest,
  SubmitMilestoneRequest,
  TransitionContractStageRequest,
  UpdateContractStageRequest,
  UpdateMilestoneRequest,
} from "@contractflow/contracts-schema";
import { api, contractRoute } from "./api";

export type {
  ContractProgress,
  ContractStage,
  CreateContractStageRequest,
  CreateMilestoneRequest,
  DecideMilestoneSubmissionRequest,
  ListMilestonesFilters,
  Milestone,
  MilestoneDecision,
  MilestoneEvidence,
  MilestoneOutstandingItem,
  MilestoneSubmission,
  SetContractStageApplicabilityRequest,
  SubmitMilestoneRequest,
  TransitionContractStageRequest,
  UpdateContractStageRequest,
  UpdateMilestoneRequest,
} from "@contractflow/contracts-schema";

/** The contract whose Project workspace is addressed, sent as headers only. */
export interface DeliveryScope {
  companyId: string;
  contractId: string;
}

type StageScope = DeliveryScope & { stageId: string };
type MilestoneScope = DeliveryScope & { milestoneId: string };
type SubmissionScope = MilestoneScope & { submissionId: string };

/**
 * One tag per contract covers every stage and milestone read. A change to one
 * milestone moves its stage's progress and the overview's counts too, so every
 * change refreshes them all rather than guessing which reads it touched.
 */
const deliveryTag = (contractId: string) => ({
  type: "ProjectDelivery" as const,
  id: contractId,
});

/**
 * After a successful change: the delivery reads, and the contract's activity
 * (tagged with the contract), which records every change.
 */
const changed = (error: unknown, contractId: string) =>
  error
    ? []
    : [deliveryTag(contractId), { type: "Contract" as const, id: contractId }];

/**
 * The Project workspace's stages and milestones (`/contract/stages`,
 * `/contract/milestones`). The company and contract travel only in the scope
 * headers; the API decides who may read and change what.
 */
export const deliveryApi = api
  .enhanceEndpoints({ addTagTypes: ["ProjectDelivery"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getContractStages: builder.query<
        IPaginatedResponse<ContractStage>,
        DeliveryScope & IPaginationQuery
      >({
        query: ({ companyId, contractId, page, limit }) => ({
          ...contractRoute(companyId, contractId, "/stages"),
          params: { page, limit },
        }),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      /** Lifecycle progress, calculated by the API. */
      getContractProgress: builder.query<ContractProgress, DeliveryScope>({
        query: ({ companyId, contractId }) =>
          contractRoute(companyId, contractId, "/progress"),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      getContractStage: builder.query<ContractStage, StageScope>({
        query: ({ companyId, contractId, stageId }) =>
          contractRoute(companyId, contractId, `/stages/${stageId}`),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      createContractStage: builder.mutation<
        ContractStage,
        DeliveryScope & { body: CreateContractStageRequest }
      >({
        query: ({ companyId, contractId, body }) => ({
          ...contractRoute(companyId, contractId, "/stages"),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      updateContractStage: builder.mutation<
        ContractStage,
        StageScope & { body: UpdateContractStageRequest }
      >({
        query: ({ companyId, contractId, stageId, body }) => ({
          ...contractRoute(companyId, contractId, `/stages/${stageId}`),
          method: "PATCH",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      transitionContractStage: builder.mutation<
        ContractStage,
        StageScope & { body: TransitionContractStageRequest }
      >({
        query: ({ companyId, contractId, stageId, body }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/stages/${stageId}/transitions`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      setContractStageApplicability: builder.mutation<
        ContractStage,
        StageScope & { body: SetContractStageApplicabilityRequest }
      >({
        query: ({ companyId, contractId, stageId, body }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/stages/${stageId}/applicability`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      /** The stage is named by the path, never by the body. */
      createMilestone: builder.mutation<
        Milestone,
        StageScope & { body: CreateMilestoneRequest }
      >({
        query: ({ companyId, contractId, stageId, body }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/stages/${stageId}/milestones`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      getMilestones: builder.query<
        IPaginatedResponse<Milestone>,
        DeliveryScope & IPaginationQuery & ListMilestonesFilters
      >({
        // Every filter is applied by the API before paging; unset ones are
        // left out of the query string.
        query: ({ companyId, contractId, ...params }) => ({
          ...contractRoute(companyId, contractId, "/milestones"),
          params,
        }),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      getMilestone: builder.query<Milestone, MilestoneScope>({
        query: ({ companyId, contractId, milestoneId }) =>
          contractRoute(companyId, contractId, `/milestones/${milestoneId}`),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      updateMilestone: builder.mutation<
        Milestone,
        MilestoneScope & { body: UpdateMilestoneRequest }
      >({
        query: ({ companyId, contractId, milestoneId, body }) => ({
          ...contractRoute(companyId, contractId, `/milestones/${milestoneId}`),
          method: "PATCH",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      startMilestone: builder.mutation<Milestone, MilestoneScope>({
        query: ({ companyId, contractId, milestoneId }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/milestones/${milestoneId}/start`,
          ),
          method: "POST",
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      /** Every submission of a milestone, oldest first, each with its decision. */
      getMilestoneSubmissions: builder.query<
        MilestoneSubmission[],
        MilestoneScope
      >({
        query: ({ companyId, contractId, milestoneId }) =>
          contractRoute(
            companyId,
            contractId,
            `/milestones/${milestoneId}/submissions`,
          ),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),

      submitMilestone: builder.mutation<
        MilestoneSubmission,
        MilestoneScope & { body: SubmitMilestoneRequest }
      >({
        query: ({ companyId, contractId, milestoneId, body }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/milestones/${milestoneId}/submissions`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      decideMilestoneSubmission: builder.mutation<
        MilestoneDecision,
        SubmissionScope & { body: DecideMilestoneSubmissionRequest }
      >({
        query: ({
          companyId,
          contractId,
          milestoneId,
          submissionId,
          body,
        }) => ({
          ...contractRoute(
            companyId,
            contractId,
            `/milestones/${milestoneId}/submissions/${submissionId}/decision`,
          ),
          method: "POST",
          body,
        }),
        invalidatesTags: (_result, error, { contractId }) =>
          changed(error, contractId),
      }),

      getMilestoneOutstandingItems: builder.query<
        MilestoneOutstandingItem[],
        MilestoneScope
      >({
        query: ({ companyId, contractId, milestoneId }) =>
          contractRoute(
            companyId,
            contractId,
            `/milestones/${milestoneId}/outstanding-items`,
          ),
        providesTags: (_result, _error, { contractId }) => [
          deliveryTag(contractId),
        ],
      }),
    }),
  });

export const {
  useGetContractStagesQuery,
  useGetContractStageQuery,
  useGetContractProgressQuery,
  useSetContractStageApplicabilityMutation,
  useCreateContractStageMutation,
  useUpdateContractStageMutation,
  useTransitionContractStageMutation,
  useCreateMilestoneMutation,
  useGetMilestonesQuery,
  useGetMilestoneQuery,
  useUpdateMilestoneMutation,
  useStartMilestoneMutation,
  useGetMilestoneSubmissionsQuery,
  useSubmitMilestoneMutation,
  useDecideMilestoneSubmissionMutation,
  useGetMilestoneOutstandingItemsQuery,
} = deliveryApi;
