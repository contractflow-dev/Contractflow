import { api } from "@/services/api";

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
  };
}

export type CreateCompanyRequest = Omit<CompanyProfile, "id" | "status">;

export interface CreateCompanyResponse extends CompanyAccess {
  message?: string;
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

    getCurrentCompany: builder.query<CompanyAccess, void>({
      query: () => "/companies/current",
      providesTags: (result) =>
        result
          ? [{ type: "Company", id: result.company.id }]
          : [{ type: "Company", id: "CURRENT" }],
    }),

    getCompanyMembership: builder.query<
      CompanyMembership,
      { companyId: string }
    >({
      query: ({ companyId }) => `/companies/${encodeURIComponent(companyId)}/membership`,
      providesTags: (_result, _error, { companyId }) => [
        { type: "Company", id: `MEMBERSHIP_${companyId}` },
      ],
    }),

    getCompanyDashboard: builder.query<
      CompanyDashboard,
      { companyId: string }
    >({
      query: ({ companyId }) => `/companies/${encodeURIComponent(companyId)}/dashboard`,
      providesTags: (_result, _error, { companyId }) => [
        { type: "Dashboard", id: companyId },
      ],
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
  useCreateCompanyMutation,
} = companiesApi;
