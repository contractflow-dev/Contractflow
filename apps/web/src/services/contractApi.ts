import type {
  AssignableContractWorkspace,
  CompanyContractDetailQuery,
  CompanyContractHistoryQuery,
  CompanyContractQuery,
  Contract,
  ContractDetail,
  ContractLifecyclePermissions,
  ContractListItem,
  ContractPartyInvitation,
  ContractPartyInvitationPreview,
  ContractPartySignatory,
  ContractPartySummary,
  ContractRoleAssignment,
  ContractRoleAssignmentQuery,
  ContractRoleInvitation,
  ContractRoleInvitationPreview,
  ContractSite,
  ContractStatusHistory,
  ContractTransition,
  ContractRoleManagementPermissions,
  ContractWorkspaceAccess,
  ContractWorkspaceAccessResponse,
  CreateContractRequest,
  CreateContractSiteRequest,
  ContractRole,
  EPartyType,
  CompanyRoleAssignment,
  CompanyRoleAssignmentFilters,
  IncomingContractInvitation,
  ContractActivityActor,
  ContractActivityFilters,
  ContractActivityItem,
  IPaginatedResponse,
  IPaginationQuery,
  RecordContractSignatoryRequest,
  RespondIncomingContractInvitationRequest,
  RespondIncomingContractInvitationResponse,
  UpdateContractSiteRequest,
} from "@contractflow/contracts-schema";
import {
  api,
  companyCollectionRoute,
  companyRoute,
  contractRoute,
} from "./api";

export type {
  CompanyRoleAssignment,
  CompanyRoleAssignmentFilters,
  ContractActivityActor,
  ContractActivityFilters,
  ContractActivityItem,
  IncomingContractInvitation,
  AssignableContractWorkspace,
  CompanyContractDetailQuery,
  CompanyContractHistoryQuery,
  CompanyContractQuery,
  Contract,
  ContractCounterparty,
  ContractListItem,
  ContractDetail,
  ContractFilterParams,
  ContractLifecyclePermissions,
  ContractMembership,
  ContractPartyInvitation,
  ContractPartyInvitationPreview,
  ContractPartySignatory,
  ContractPartySummary,
  ContractRoleAssignment,
  ContractRoleAssignmentQuery,
  ContractRoleInvitation,
  ContractRoleInvitationPreview,
  ContractSite,
  ContractStatusHistory,
  ContractTransition,
  ContractRoleManagementPermissions,
  ContractWorkspaceAccess,
  ContractWorkspaceAccessResponse,
  CreateContractRequest,
  CreateContractSiteRequest,
  ContractRole,
  EPartyType,
  RecordContractSignatoryRequest,
  UpdateContractSiteRequest,
} from "@contractflow/contracts-schema";

/** Every workspace a contract can enable, in display order. */
const WORKSPACES: AssignableContractWorkspace[] = ["project", "hse", "finance"];

const roleAssignmentTag = (
  contractId: string,
  workspace: AssignableContractWorkspace,
) => ({
  type: "ContractRoleAssignment" as const,
  id: `${contractId}:${workspace}`,
});

const signatoryTag = (contractId: string) => ({
  type: "Contract" as const,
  id: `signatory:${contractId}`,
});

const managedSitesTag = (contractId: string) => ({
  type: "Contract" as const,
  id: `sites:${contractId}`,
});

const roleInvitationTag = (
  contractId: string,
  workspace: AssignableContractWorkspace,
) => ({
  type: "ContractRoleAssignment" as const,
  id: `invitations:${contractId}:${workspace}`,
});

export const contractApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getContracts: builder.query<
      IPaginatedResponse<ContractListItem>,
      CompanyContractQuery
    >({
      query: ({ companyId, ...params }) => ({
        ...companyCollectionRoute(companyId, "/contracts"),
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Contract" as const,
                id,
              })),
              { type: "Contract", id: "LIST" },
            ]
          : [{ type: "Contract", id: "LIST" }],
    }),

    getContractById: builder.query<ContractDetail, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId),
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
        ...contractRoute(companyId, contractId, `/parties`),
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    getContractSignatory: builder.query<
      ContractPartySignatory,
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/parties/signatory`),
      }),
      providesTags: (_result, _error, { contractId }) => [
        signatoryTag(contractId),
      ],
    }),

    recordContractSignatory: builder.mutation<
      ContractPartySignatory,
      CompanyContractDetailQuery & { body: RecordContractSignatoryRequest }
    >({
      query: ({ companyId, contractId, body }) => ({
        ...contractRoute(companyId, contractId, `/parties/signatory`),
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, error, { contractId }) =>
        error
          ? []
          : [signatoryTag(contractId), { type: "Contract", id: contractId }],
    }),

    getManagedContractSites: builder.query<
      ContractSite[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/site-management`),
      }),
      providesTags: (_result, _error, { contractId }) => [
        managedSitesTag(contractId),
      ],
    }),

    createContractSite: builder.mutation<
      ContractSite,
      CompanyContractDetailQuery & { body: CreateContractSiteRequest }
    >({
      query: ({ companyId, contractId, body }) => ({
        ...contractRoute(companyId, contractId, `/sites`),
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, error, { contractId }) =>
        error ? [] : [managedSitesTag(contractId)],
    }),

    updateContractSite: builder.mutation<
      ContractSite,
      CompanyContractDetailQuery & {
        siteId: string;
        body: UpdateContractSiteRequest;
      }
    >({
      query: ({ companyId, contractId, siteId, body }) => ({
        ...contractRoute(companyId, contractId, `/sites/${encodeURIComponent(siteId)}`),
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, error, { contractId }) =>
        error ? [] : [managedSitesTag(contractId)],
    }),

    getContractStatusHistory: builder.query<
      IPaginatedResponse<ContractStatusHistory>,
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
        ...contractRoute(companyId, contractId, `/status-history`),
        params: { page, limit, fromDate, toDate, status, userId },
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    /**
     * Actions members of the header company took on the contract, newest
     * first. The API needs an active contract role and returns only this
     * company's entries.
     */
    getContractActivity: builder.query<
      IPaginatedResponse<ContractActivityItem>,
      CompanyContractDetailQuery & IPaginationQuery & ContractActivityFilters
    >({
      // The filters are applied by the API, before paging; unset ones are
      // left out of the query string.
      query: ({
        companyId,
        contractId,
        page,
        limit,
        fromDate,
        toDate,
        actorUserId,
        action,
      }) => ({
        ...contractRoute(companyId, contractId, `/activity`),
        params: { page, limit, fromDate, toDate, actorUserId, action },
      }),
      // Contract changes refresh it with the status history.
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    /** Members of the header company with activity here: the actor filter. */
    getContractActivityActors: builder.query<
      ContractActivityActor[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/activity/actors`),
      }),
      providesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    /** The signed-in member's access to each enabled workspace. */
    getContractWorkspaceAccess: builder.query<
      ContractWorkspaceAccessResponse,
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/workspace-access`),
      }),
      // Role changes in any workspace refresh it.
      providesTags: (_result, _error, { contractId }) => [
        ...WORKSPACES.map((workspace) => roleAssignmentTag(contractId, workspace)),
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "Contract", id: contractId },
      ],
    }),

    /** One workspace; the API refuses it (403) without a role there. */
    getContractWorkspace: builder.query<
      ContractWorkspaceAccess,
      CompanyContractDetailQuery & { workspace: AssignableContractWorkspace }
    >({
      query: ({ companyId, contractId, workspace }) => ({
        ...contractRoute(
          companyId,
          contractId,
          `/workspaces/${encodeURIComponent(workspace)}`,
        ),
      }),
      providesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "Contract", id: contractId },
      ],
    }),

    getContractWorkspaces: builder.query<
      AssignableContractWorkspace[],
      CompanyContractDetailQuery
    >({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/workspaces`),
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
        ...contractRoute(companyId, contractId, `/lifecycle-permissions`),
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
        ...companyCollectionRoute(companyId, "/contracts"),
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
        ...contractRoute(companyId, contractId),
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
        ...contractRoute(companyId, contractId, `/workspaces`),
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
        ...contractRoute(companyId, contractId, `/transitions`),
        method: "POST",
        body: { transition, reason },
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
      ],
    }),

    archiveContract: builder.mutation<void, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId),
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: "Contract", id: contractId },
        { type: "Contract", id: "LIST" },
      ],
    }),

    restoreContract: builder.mutation<Contract, CompanyContractDetailQuery>({
      query: ({ companyId, contractId }) => ({
        ...contractRoute(companyId, contractId, `/restore`),
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
        ...contractRoute(companyId, contractId, `/party-invitations`),
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
        ...contractRoute(companyId, contractId, `/party-invitations`),
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
        ...contractRoute(companyId, contractId, `/party-invitations/${encodeURIComponent(invitationId)}`),
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
        ...companyCollectionRoute(
          companyId,
          "/contract-party-invitations/respond",
        ),
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
        ...contractRoute(companyId, contractId, `/role-assignments`),
        params: { workspace },
      }),
      providesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
      ],
    }),

    getContractRoleManagementPermissions: builder.query<
      ContractRoleManagementPermissions,
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        ...contractRoute(companyId, contractId, `/role-management`),
        params: { workspace },
      }),
    }),

    getContractRoleAssignmentMembers: builder.query<
      Array<{ id: string; firstName: string; lastName: string; email: string }>,
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        ...contractRoute(companyId, contractId, `/role-assignment-members`),
        params: { workspace },
      }),
    }),

    assignContractRole: builder.mutation<
      ContractRoleAssignment,
      ContractRoleAssignmentQuery & {
        companyUserId: string;
        role: ContractRole;
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
        ...contractRoute(companyId, contractId, `/role-assignments`),
        method: "POST",
        params: { workspace },
        body: { companyUserId, role, isWorkspaceAdmin },
      }),
      // A role is what makes a contract visible to an ordinary member, so the
      // contract list and detail are refreshed too (the API re-decides).
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "ContractLifecyclePermission", id: contractId },
        { type: "Contract", id: "LIST" },
        { type: "Contract", id: contractId },
      ],
    }),

    revokeContractRole: builder.mutation<
      ContractRoleAssignment,
      ContractRoleAssignmentQuery & { assignmentId: string }
    >({
      query: ({ companyId, contractId, assignmentId }) => ({
        ...contractRoute(companyId, contractId, `/role-assignments/${encodeURIComponent(assignmentId)}`),
        method: "DELETE",
      }),
      // Revoking the last role hides the contract from an ordinary member.
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "ContractLifecyclePermission", id: contractId },
        { type: "Contract", id: "LIST" },
        { type: "Contract", id: contractId },
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
        ...contractRoute(companyId, contractId, `/role-assignments/${encodeURIComponent(assignmentId)}/workspace-admin`),
        method: "PATCH",
        body: { isWorkspaceAdmin },
      }),
      invalidatesTags: (_result, _error, { contractId, workspace }) => [
        roleAssignmentTag(contractId, workspace),
        // The list shows the viewer's own Workspace Admin flag.
        { type: "Contract", id: "LIST" },
      ],
    }),

    getContractRoleInvitations: builder.query<
      ContractRoleInvitation[],
      ContractRoleAssignmentQuery
    >({
      query: ({ companyId, contractId, workspace }) => ({
        ...contractRoute(companyId, contractId, `/role-invitations`),
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
        role: ContractRole;
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
        ...contractRoute(companyId, contractId, `/role-invitations`),
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
        ...contractRoute(companyId, contractId, `/role-invitations/${encodeURIComponent(invitationId)}`),
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
      // Accepting creates the role that makes the contract visible.
      invalidatesTags: [
        { type: "CompanyMember", id: "LIST" },
        { type: "ContractRoleAssignment", id: "LIST" },
        { type: "ContractLifecyclePermission", id: "LIST" },
        { type: "Contract", id: "LIST" },
      ],
    }),

    /** Contract roles held across the header company. Administrators only. */
    getCompanyRoleAssignments: builder.query<
      IPaginatedResponse<CompanyRoleAssignment>,
      { companyId: string; page: number; limit: number } &
        CompanyRoleAssignmentFilters
    >({
      query: ({ companyId, ...params }) => ({
        ...companyRoute(companyId, "/role-assignments"),
        params,
      }),
      providesTags: (_result, _error, { companyId }) => [
        { type: "ContractRoleAssignment", id: `company:${companyId}` },
      ],
    }),

    /** Invitations for the header company to join other companies' contracts. */
    getIncomingContractInvitations: builder.query<
      IncomingContractInvitation[],
      { companyId: string }
    >({
      query: ({ companyId }) =>
        companyRoute(companyId, "/contract-invitations"),
      providesTags: (_result, _error, { companyId }) => [
        { type: "ContractPartyInvitation", id: `incoming:${companyId}` },
      ],
    }),

    respondToIncomingContractInvitation: builder.mutation<
      RespondIncomingContractInvitationResponse,
      { companyId: string; invitationId: string } &
        RespondIncomingContractInvitationRequest
    >({
      query: ({ companyId, invitationId, decision }) => ({
        ...companyRoute(
          companyId,
          `/contract-invitations/${encodeURIComponent(invitationId)}/respond`,
        ),
        method: "POST",
        body: { decision },
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "ContractPartyInvitation", id: `incoming:${companyId}` },
        { type: "Contract", id: "LIST" },
        "Dashboard",
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
  useGetContractActivityQuery,
  useGetContractActivityActorsQuery,
  useGetContractSignatoryQuery,
  useGetManagedContractSitesQuery,
  useCreateContractSiteMutation,
  useUpdateContractSiteMutation,
  useRecordContractSignatoryMutation,
  useGetContractWorkspacesQuery,
  useGetContractWorkspaceAccessQuery,
  useGetContractWorkspaceQuery,
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
  useGetCompanyRoleAssignmentsQuery,
  useGetIncomingContractInvitationsQuery,
  useRespondToIncomingContractInvitationMutation,
} = contractApi;
