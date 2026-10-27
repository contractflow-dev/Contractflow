import type {
  ECurrencyCode,
  EContractRole,
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
  description: string | null;
  contractType: EContractType;
  status: EContractStatus;
  parentContractId: string | null;
  originalValueMinor: number | string;
  currentValueMinor: number | string;
  currencyCode: string;
  retentionRateBps: number;
  advancePaymentRateBps: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor: number | string | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate: string | null;
  actualCompletionDate: string | null;
  defectsLiabilityDays: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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
  includeDeleted?: boolean;
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
  fromStatus: EFromStatus | null;
  toStatus: EToStatus;
  reason: string | null;
  changedById: string;
  changedAt: string;
  changedBy?: { userId: string; firstName: string; lastName: string } | null;
}

export interface CompanyContractQuery extends ContractFilterParams {
  companyId: string;
}

export interface CompanyContractDetailQuery {
  companyId: string;
  contractId: string;
}

export interface CompanyContractHistoryQuery extends CompanyContractDetailQuery {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  status?: EContractStatus;
  userId?: string;
}

export type AssignableContractWorkspace = "project" | "hse" | "finance";
export type ContractTransition = "activate" | "hold" | "resume" | "complete";

export interface ContractPartyInvitation {
  id: string;
  email: string;
  partyType: EPartyType;
  status: "pending" | "accepted" | "rejected" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  revokedAt: string | null;
}

export interface ContractPartyInvitationPreview {
  companyId: string;
  contractTitle: string;
  invitingCompanyName: string;
  email: string;
  partyType: EPartyType;
  expiresAt: string;
}

export interface CreateContractRequest {
  referenceNumber: string;
  title: string;
  description?: string | null;
  contractType: EContractType;
  partyType: EPartyType;
  workspaces: AssignableContractWorkspace[];
  parentContractId?: string | null;
  originalValueMinor: number;
  currencyCode: ECurrencyCode;
  retentionRateBps: number;
  advancePaymentRateBps?: number | null;
  paymentTermsDays: number;
  liquidatedDamagesPerDayMinor?: number | null;
  awardDate: string;
  startDate: string;
  endDate: string;
  revisedEndDate?: string | null;
  actualCompletionDate?: string | null;
  defectsLiabilityDays: number;
  timezone: string;
}

export interface ContractRoleAssignment {
  id: string;
  contractPartyId: string;
  companyUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  assignedAt: string;
  assignedById: string;
  revokedAt: string | null;
  revokedById: string | null;
}

export interface ContractRoleInvitation {
  id: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  status: "pending" | "accepted" | "rejected" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  revokedAt: string | null;
}

export interface ContractRoleInvitationPreview {
  contractTitle: string;
  companyName: string;
  email: string;
  role: EContractRole;
  workspace: AssignableContractWorkspace;
  isWorkspaceAdmin: boolean;
  expiresAt: string;
}

export interface ContractRoleAssignmentQuery extends CompanyContractDetailQuery {
  workspace: AssignableContractWorkspace;
}

export interface ContractLifecyclePermissions {
  canManage: boolean;
  canTransition: boolean;
  canRestore: boolean;
}

const roleAssignmentTag = (
  contractId: string,
  workspace: AssignableContractWorkspace,
) => ({
  type: "ContractRoleAssignment" as const,
  id: `${contractId}:${workspace}`,
});

const roleInvitationTag = (
  contractId: string,
  workspace: AssignableContractWorkspace,
) => ({
  type: "ContractRoleAssignment" as const,
  id: `invitations:${contractId}:${workspace}`,
});

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
      query: ({
        companyId,
        contractId,
        page,
        limit,
        fromDate,
        toDate,
        status,
        userId,
      }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/status-history`,
        params: { page, limit, fromDate, toDate, status, userId },
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    getContractWorkspaces: builder.query<
      AssignableContractWorkspace[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/workspaces`,
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    getContractLifecyclePermissions: builder.query<
      ContractLifecyclePermissions,
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/lifecycle-permissions`,
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "ContractLifecyclePermission", id: contractId },
        { type: "ContractLifecyclePermission", id: "LIST" },
        { type: "Contract", id: contractId },
      ],
    }),

    createContract: builder.mutation<
      Contract,
      { companyId: string; body: CreateContractRequest }
    >({
      query: ({ companyId, body }) => ({
        url: contractsUrl(companyId),
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Contract", id: "LIST" }],
    }),

    updateContract: builder.mutation<
      Contract,
      CompanyContractDetailQuery & { body: Partial<CreateContractRequest> }
    >({
      query: ({ companyId, contractId, body }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
        { type: "Contract", id: "LIST" },
      ],
    }),

    updateContractWorkspaces: builder.mutation<
      AssignableContractWorkspace[],
      CompanyContractDetailQuery & { workspaces: AssignableContractWorkspace[] }
    >({
      query: ({ companyId, contractId, workspaces }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/workspaces`,
        method: "PATCH",
        body: { workspaces },
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    transitionContract: builder.mutation<
      Contract,
      CompanyContractDetailQuery & {
        transition: ContractTransition;
        reason: string;
      }
    >({
      query: ({ companyId, contractId, transition, reason }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/transitions`,
        method: "POST",
        body: { transition, reason },
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    archiveContract: builder.mutation<void, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
        { type: "Contract", id: "LIST" },
      ],
    }),

    restoreContract: builder.mutation<Contract, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/restore`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
        { type: "Contract", id: "LIST" },
      ],
    }),

    getContractPartyInvitations: builder.query<
      ContractPartyInvitation[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/party-invitations`,
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "ContractPartyInvitation", id: contractId },
      ],
    }),

    createContractPartyInvitation: builder.mutation<
      ContractPartyInvitation,
      CompanyContractDetailQuery & {
        email: string;
        partyType: EPartyType;
      }
    >({
      query: ({ companyId, contractId, email, partyType }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/party-invitations`,
        method: "POST",
        body: { email, partyType },
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "ContractPartyInvitation", id: contractId },
        { type: "Contract", id: contractId },
      ],
    }),

    revokeContractPartyInvitation: builder.mutation<
      ContractPartyInvitation,
      CompanyContractDetailQuery & { invitationId: string }
    >({
      query: ({ companyId, contractId, invitationId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/party-invitations/${encodeURIComponent(invitationId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "ContractPartyInvitation", id: contractId },
      ],
    }),

    getPublicContractPartyInvitation: builder.query<
      ContractPartyInvitationPreview,
      { token: string }
    >({
      query: ({ token }) => ({
        url: "/contract-party-invitations/preview",
        method: "POST",
        body: { token },
      }),
    }),

    respondToContractPartyInvitation: builder.mutation<
      { status: "accepted" | "rejected" },
      { companyId: string; token: string; decision: "accept" | "reject" }
    >({
      query: ({ companyId, token, decision }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/contract-party-invitations/respond`,
        method: "POST",
        body: { token, decision },
      }),
      invalidatesTags: [
        { type: "Contract", id: "LIST" },
        { type: "CompanyMember", id: "LIST" },
      ],
    }),

    getContractRoleAssignments: builder.query<
      ContractRoleAssignment[],
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-assignments`,
        params: { workspace },
      }),
      providesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
      ],
    }),

    getContractRoleManagementPermissions: builder.query<
      { canManage: boolean; canGrantWorkspaceAdmin: boolean },
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-management`,
        params: { workspace },
      }),
    }),

    getContractRoleAssignmentMembers: builder.query<
      Array<{ id: string; firstName: string; lastName: string; email: string }>,
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-assignment-members`,
        params: { workspace },
      }),
    }),

    assignContractRole: builder.mutation<
      ContractRoleAssignment,
      ContractRoleAssignmentQuery & {
        companyUserId: string;
        role: EContractRole;
        isWorkspaceAdmin?: boolean;
      }
    >({
      query: ({
        companyId,
        contractId,
        workspace,
        companyUserId,
        role,
        isWorkspaceAdmin,
      }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-assignments`,
        method: "POST",
        params: { workspace },
        body: { companyUserId, role, isWorkspaceAdmin },
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "ContractLifecyclePermission", id: contractId },
      ],
    }),

    revokeContractRole: builder.mutation<
      ContractRoleAssignment,
      ContractRoleAssignmentQuery & { assignmentId: string }
    >({
      query: ({ companyId, contractId, assignmentId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-assignments/${encodeURIComponent(assignmentId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractLifecyclePermission", id: contractId },
      ],
    }),

    setContractWorkspaceAdmin: builder.mutation<
      ContractRoleAssignment,
      ContractRoleAssignmentQuery & {
        assignmentId: string;
        isWorkspaceAdmin: boolean;
      }
    >({
      query: ({ companyId, contractId, assignmentId, isWorkspaceAdmin }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-assignments/${encodeURIComponent(assignmentId)}/workspace-admin`,
        method: "PATCH",
        body: { isWorkspaceAdmin },
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
      ],
    }),

    getContractRoleInvitations: builder.query<
      ContractRoleInvitation[],
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-invitations`,
        params: { workspace },
      }),
      providesTags: (_result, _error, { contractId, workspace }) => [
        roleInvitationTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
      ],
    }),

    createContractRoleInvitation: builder.mutation<
      ContractRoleInvitation,
      ContractRoleAssignmentQuery & {
        email: string;
        role: EContractRole;
        isWorkspaceAdmin: boolean;
      }
    >({
      query: ({
        companyId,
        contractId,
        workspace,
        email,
        role,
        isWorkspaceAdmin,
      }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-invitations`,
        method: "POST",
        params: { workspace },
        body: { email, role, isWorkspaceAdmin },
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleInvitationTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
      ],
    }),

    revokeContractRoleInvitation: builder.mutation<
      ContractRoleInvitation,
      ContractRoleAssignmentQuery & { invitationId: string }
    >({
      query: ({ companyId, contractId, invitationId }) => ({
        url: `${contractsUrl(companyId)}/${encodeURIComponent(contractId)}/role-invitations/${encodeURIComponent(invitationId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleInvitationTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
      ],
    }),

    getPublicContractRoleInvitation: builder.query<
      ContractRoleInvitationPreview,
      { token: string }
    >({
      query: ({ token }) => ({
        url: "/contract-role-invitations/preview",
        method: "POST",
        body: { token },
      }),
    }),

    respondToContractRoleInvitation: builder.mutation<
      { status: "accepted" | "rejected" },
      { token: string; decision: "accept" | "decline" }
    >({
      query: ({ token, decision }) => ({
        url: "/contract-role-invitations/respond",
        method: "POST",
        body: { token, decision },
      }),
      invalidatesTags: [
        { type: "CompanyMember", id: "LIST" },
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "ContractLifecyclePermission", id: "LIST" },
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
  useGetContractWorkspacesQuery,
  useGetContractLifecyclePermissionsQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
  useUpdateContractWorkspacesMutation,
  useTransitionContractMutation,
  useArchiveContractMutation,
  useRestoreContractMutation,
  useGetContractPartyInvitationsQuery,
  useCreateContractPartyInvitationMutation,
  useRevokeContractPartyInvitationMutation,
  useGetPublicContractPartyInvitationQuery,
  useRespondToContractPartyInvitationMutation,
  useGetContractRoleAssignmentsQuery,
  useGetContractRoleManagementPermissionsQuery,
  useGetContractRoleAssignmentMembersQuery,
  useAssignContractRoleMutation,
  useRevokeContractRoleMutation,
  useSetContractWorkspaceAdminMutation,
  useGetContractRoleInvitationsQuery,
  useCreateContractRoleInvitationMutation,
  useRevokeContractRoleInvitationMutation,
  useGetPublicContractRoleInvitationQuery,
  useRespondToContractRoleInvitationMutation,
} = contractApi;
