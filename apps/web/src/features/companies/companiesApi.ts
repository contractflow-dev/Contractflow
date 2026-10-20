import { api } from "@/services/api";
import type {
  ECompanyUserStatus,
  ECompanyRole,
  EInvitationRole,
  EInvitationStatus,
} from "@contractflow/contracts-schema";

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxIdentificationNumber: string;
  email: string;
  phoneNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: string;
  defaultCurrencyCode: string;
  status: string;
}

export interface CompanyMembership {
  id: string;
  companyId: string;
  companyRole: string;
  status: string;
  canManageCompany: boolean;
}

export interface CompanyAccess {
  company: CompanyProfile;
  membership: CompanyMembership;
}

export interface CompanyDashboard extends CompanyAccess {
  summary: {
    activeMembershipCount: number;
    pendingInvitationCount: number;
    activeContractCount: number;
    expiringContractCount: number;
  };
}

export type CreateCompanyRequest = Omit<CompanyProfile, "id" | "status">;

export interface CreateCompanyResponse extends CompanyAccess {
  message?: string;
}

export interface CompanyMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  joinedAt: string;
  leftAt: string | null;
}

export interface CompanyMembersPage {
  items: CompanyMember[];
  total: number;
  page: number;
  limit: number;
}

export interface CompanyInvitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyRole: EInvitationRole;
  status: EInvitationStatus | "expired" | "revoked";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface CompanyInvitationsPage {
  items: CompanyInvitation[];
  total: number;
  page: number;
  limit: number;
}

export interface InviteCompanyMemberRequest {
  email: string;
  firstName: string;
  lastName: string;
  companyRole: EInvitationRole;
}

export interface UpdateCompanyProfileRequest {
  name?: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  countryCode?: string;
  defaultCurrencyCode?: string;
}

export interface PublicCompanyInvitation {
  companyName: string;
  email: string;
  companyRole: EInvitationRole;
  expiresAt: string;
}

export const companiesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCompanies: builder.query<CompanyAccess[], void>({
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

    getCurrentCompany: builder.query<CompanyProfile, void>({
      query: () => "/companies/current",
      providesTags: (result) =>
        result
          ? [{ type: "Company", id: result.id }]
          : [{ type: "Company", id: "CURRENT" }],
    }),

    getCompanyMembership: builder.query<
      CompanyMembership,
      { companyId: string }
    >({
      query: ({ companyId }) =>
        `/companies/${encodeURIComponent(companyId)}/membership`,
      providesTags: (_result, _error, { companyId }) => [
        { type: "Company", id: `MEMBERSHIP_${companyId}` },
      ],
    }),

    getCompanyDashboard: builder.query<CompanyDashboard, { companyId: string }>(
      {
        query: ({ companyId }) =>
          `/companies/${encodeURIComponent(companyId)}/dashboard`,
        providesTags: (_result, _error, { companyId }) => [
          { type: "Dashboard", id: companyId },
        ],
      },
    ),

    getCompanyMembers: builder.query<
      CompanyMembersPage,
      {
        companyId: string;
        page?: number;
        limit?: number;
        search?: string;
        status?: ECompanyUserStatus;
      }
    >({
      query: ({ companyId, ...params }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/members`,
        params,
      }),
      providesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
      ],
    }),

    getCompanyInvitations: builder.query<
      CompanyInvitationsPage,
      { companyId: string; page?: number; limit?: number }
    >({
      query: ({ companyId, ...params }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/invitations`,
        params,
      }),
      providesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
      ],
    }),

    inviteCompanyMember: builder.mutation<
      CompanyInvitation,
      { companyId: string; data: InviteCompanyMemberRequest }
    >({
      query: ({ companyId, data }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/invitations`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
        { type: "Dashboard", id: companyId },
      ],
    }),

    revokeCompanyInvitation: builder.mutation<
      CompanyInvitation,
      { companyId: string; invitationId: string }
    >({
      query: ({ companyId, invitationId }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyInvitation", id: companyId },
        { type: "Dashboard", id: companyId },
      ],
    }),

    changeCompanyMemberRole: builder.mutation<
      CompanyMember,
      { companyId: string; membershipId: string; companyRole: ECompanyRole }
    >({
      query: ({ companyId, membershipId, companyRole }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}/role`,
        method: "PATCH",
        body: { companyRole },
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
      ],
    }),

    removeCompanyMember: builder.mutation<
      void,
      { companyId: string; membershipId: string }
    >({
      query: ({ companyId, membershipId }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { companyId }) => [
        { type: "CompanyMember", id: companyId },
        { type: "Company", id: "LIST" },
        { type: "Dashboard", id: companyId },
      ],
    }),

    updateCompanyProfile: builder.mutation<
      CompanyProfile,
      { companyId: string; data: UpdateCompanyProfileRequest }
    >({
      query: ({ companyId, data }) => ({
        url: `/companies/${encodeURIComponent(companyId)}/profile`,
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
      PublicCompanyInvitation,
      { token: string }
    >({
      query: (body) => ({
        url: "/invitations/preview",
        method: "POST",
        body,
      }),
    }),

    respondToCompanyInvitation: builder.mutation<
      { status: EInvitationStatus },
      { token: string; decision: "accept" | "decline" }
    >({
      query: (body) => ({
        url: "/invitations/respond",
        method: "POST",
        body,
      }),
    }),

    createCompany: builder.mutation<
      CreateCompanyResponse,
      CreateCompanyRequest
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
