import { api, companyRoute } from "@/services/api";
import type {
  ECompanyRole,
  ECompanyUserStatus,
  ICompanyAccessResponse,
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
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Dashboard", id: companyId },
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
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Dashboard", id: companyId },
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
        "Onboarding",
        "Dashboard",
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCompaniesQuery,
  useGetCurrentCompanyQuery,
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
