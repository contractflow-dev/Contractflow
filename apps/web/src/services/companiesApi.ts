import { api, companyRoute } from "@/services/api";
import { EInvitationStatus } from "@contractflow/contracts-schema";
import type {
  ECompanyRole,
  ECompanyUserStatus,
  ICompanyAccessResponse,
  ICompanyAccessSummaryResponse,
  ICompanyDashboardResponse,
  ICompanyInvitation,
  ICompanyInvitationResponseRequest,
  ICompanyInvitationResponseResult,
  ICompanyMember,
  ICompanyProfileResponse,
  ICreateCompanyRequest,
  ICreateCompanyResponse,
  IInviteCompanyMemberRequest,
  IPaginatedResponse,
  IPaginationQuery,
  IPublicCompanyInvitation,
  IUpdateCompanyProfileRequest,
} from "@contractflow/contracts-schema";

/** The token's invitation preview; distinct from the per-company admin lists. */
function publicInvitationTag(token: string) {
  return { type: "CompanyInvitation" as const, id: `PUBLIC_${token}` };
}

export const companiesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCompanies: builder.query<ICompanyAccessResponse[], void>({
      query: () => "/companies",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ company }) => ({
                type: "Company" as const,
                id: company.id,
              })),
              { type: "Company" as const, id: "LIST" },
            ]
          : [{ type: "Company", id: "LIST" }],
    }),

    getCurrentCompany: builder.query<ICompanyProfileResponse, void>({
      query: () => "/companies/current",
      providesTags: (result) =>
        result
          ? [{ type: "Company", id: result.id }]
          : [{ type: "Company", id: "CURRENT" }],
    }),

    getCompanyAccessSummary: builder.query<ICompanyAccessSummaryResponse, void>(
      {
        query: () => "/companies/access-summary",
        providesTags: [{ type: "Company", id: "ACCESS_SUMMARY" }],
      },
    ),

    verifyCompanyEmail: builder.mutation<
      { message: string; companyName: string },
      { token: string }
    >({
      query: (body) => ({
        url: "/companies/verify-email",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Company", id: "LIST" }, "Dashboard"],
    }),

    resendCompanyVerificationEmail: builder.mutation<
      { message: string },
      { companyId: string }
    >({
      query: ({ companyId }) => ({
        ...companyRoute(companyId, "/verification-email"),
        method: "POST",
      }),
    }),

    getCompanyMembership: builder.query<
      ICompanyAccessResponse,
      { companyId: string }
    >({
      query: ({ companyId }) => companyRoute(companyId, "/membership"),
      providesTags: (_result, _error, { companyId }) => [
        { type: "Company", id: `MEMBERSHIP_${companyId}` },
      ],
    }),

    getCompanyDashboard: builder.query<
      ICompanyDashboardResponse,
      { companyId: string }
    >({
      query: ({ companyId }) => companyRoute(companyId, "/dashboard"),
      providesTags: (_result, _error, { companyId }) => [
        { type: "Dashboard", id: companyId },
      ],
    }),

    getCompanyMembers: builder.query<
      IPaginatedResponse<ICompanyMember>,
      IPaginationQuery & {
        companyId: string;
        search?: string;
        status?: ECompanyUserStatus;
      }
    >({
      query: ({ companyId, ...params }) => ({
        ...companyRoute(companyId, `/members`),
        params,
      }),
      providesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
      ],
    }),

    getCompanyInvitations: builder.query<
      IPaginatedResponse<ICompanyInvitation>,
      IPaginationQuery & { companyId: string }
    >({
      query: ({ companyId, ...params }) => ({
        ...companyRoute(companyId, `/invitations`),
        params,
      }),
      providesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
      ],
    }),

    inviteCompanyMember: builder.mutation<
      ICompanyInvitation,
      { companyId: string; data: IInviteCompanyMemberRequest }
    >({
      query: ({ companyId, data }) => ({
        ...companyRoute(companyId, `/invitations`),
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
        { type: "Dashboard", id: companyId },
      ],
    }),

    revokeCompanyInvitation: builder.mutation<
      ICompanyInvitation,
      { companyId: string; invitationId: string }
    >({
      query: ({ companyId, invitationId }) => ({
        ...companyRoute(companyId, `/invitations/${encodeURIComponent(invitationId)}/revoke`),
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
        { type: "Dashboard", id: companyId },
      ],
    }),

    changeCompanyMemberRole: builder.mutation<
      ICompanyMember,
      { companyId: string; membershipId: string; companyRole: ECompanyRole }
    >({
      query: ({ companyId, membershipId, companyRole }) => ({
        ...companyRoute(companyId, `/members/${encodeURIComponent(membershipId)}/role`),
        method: "PATCH",
        body: { companyRole },
      }),
      // A Company Administrator sees every party contract (oversight); a
      // Member only those they hold a role on. Changing the role, including
      // one's own, changes which contracts are visible, so refresh them all.
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Dashboard", id: companyId },
        "Contract",
        "ContractLifecyclePermission",
        "ContractRoleAssignment",
      ],
    }),

    removeCompanyMember: builder.mutation<
      void,
      { companyId: string; membershipId: string }
    >({
      query: ({ companyId, membershipId }) => ({
        ...companyRoute(companyId, `/members/${encodeURIComponent(membershipId)}`),
        method: "DELETE",
      }),
      // The departed member's contract roles stop counting; refresh the role
      // views that list them.
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Dashboard", id: companyId },
        "ContractRoleAssignment",
      ],
    }),

    updateCompanyProfile: builder.mutation<
      ICompanyProfileResponse,
      { companyId: string; data: IUpdateCompanyProfileRequest }
    >({
      query: ({ companyId, data }) => ({
        ...companyRoute(companyId, `/profile`),
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "Company", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Company", id: "CURRENT" },
        { type: "Dashboard", id: companyId },
      ],
    }),

    getPublicCompanyInvitation: builder.query<
      IPublicCompanyInvitation,
      { token: string }
    >({
      query: (body) => ({
        url: "/invitations/preview",
        method: "POST",
        body,
      }),
      providesTags: (_result, _error, { token }) => [
        publicInvitationTag(token),
      ],
    }),

    respondToCompanyInvitation: builder.mutation<
      ICompanyInvitationResponseResult,
      ICompanyInvitationResponseRequest
    >({
      query: (body) => ({
        url: "/invitations/respond",
        method: "POST",
        body,
      }),
      // Nothing changed on the server when the request failed.
      invalidatesTags: (result, error, { token }) => {
        if (error || !result) return [];
        // The invitation is no longer pending, whatever the outcome. Only
        // accepting adds a membership; declined and expired invitations leave
        // the user's companies unchanged.
        return [
          publicInvitationTag(token),
          ...(result.status === EInvitationStatus.ACCEPTED
            ? [
                { type: "Company" as const, id: "LIST" },
                { type: "Company" as const, id: "ACCESS_SUMMARY" },
                { type: "Company" as const, id: "CURRENT" },
                // A returning member must not see contracts cached from an
                // earlier membership; the API decides again.
                { type: "Contract" as const, id: "LIST" },
              ]
            : []),
        ];
      },
    }),

    createCompany: builder.mutation<
      ICreateCompanyResponse,
      ICreateCompanyRequest
    >({
      query: (data) => ({
        url: "/companies",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        { type: "Company", id: "LIST" },
        { type: "Company", id: "ACCESS_SUMMARY" },
        "Dashboard",
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCompaniesQuery,
  useGetCurrentCompanyQuery,
  useGetCompanyAccessSummaryQuery,
  useVerifyCompanyEmailMutation,
  useResendCompanyVerificationEmailMutation,
  useGetCompanyMembershipQuery,
  useGetCompanyDashboardQuery,
  useGetCompanyMembersQuery,
  useGetCompanyInvitationsQuery,
  useInviteCompanyMemberMutation,
  useRevokeCompanyInvitationMutation,
  useChangeCompanyMemberRoleMutation,
  useRemoveCompanyMemberMutation,
  useUpdateCompanyProfileMutation,
  useGetPublicCompanyInvitationQuery,
  useRespondToCompanyInvitationMutation,
  useCreateCompanyMutation,
} = companiesApi;
