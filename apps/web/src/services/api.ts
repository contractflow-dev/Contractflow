import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearUser } from "@/features/auth/authSlice";
import type { RootState } from "@/store";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const COMPANY_CONTEXT_EXEMPT_ENDPOINTS = new Set([
  "getCurrentUser",
  "login",
  "register",
  "verifyEmail",
  "resendVerificationEmail",
  "logout",
  "getCompanies",
  "getCurrentCompany",
  "createCompany",
  "getPublicCompanyInvitation",
  "respondToCompanyInvitation",
  "getPublicContractPartyInvitation",
  "getPublicContractRoleInvitation",
  "respondToContractRoleInvitation",
  "getOnboardingStatus",
  "submitProfile",
  "submitRole",
  "completeOnboarding",
  "getAdminOverview",
]);

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
  prepareHeaders: (headers, { endpoint, getState }) => {
    if (COMPANY_CONTEXT_EXEMPT_ENDPOINTS.has(endpoint)) {
      headers.delete("X-Company-Id");
      return headers;
    }

    // An endpoint that names its company (through companyRoute) keeps it;
    // otherwise the active workspace supplies the company context.
    if (headers.has("X-Company-Id")) return headers;
    const companyId = (getState() as RootState).workspace.activeWorkspaceId;
    if (companyId) {
      headers.set("X-Company-Id", companyId);
    }
    return headers;
  },
});

type ScopedRoute = { url: string; headers: Record<string, string> };

/**
 * Company and contract IDs never appear in API URLs or query strings; the API
 * reads them only from these headers. Spread the result into an endpoint's
 * `query` return value.
 */
export function companyRoute(companyId: string, path = ""): ScopedRoute {
  return { url: `/company${path}`, headers: { "X-Company-Id": companyId } };
}

export function companyCollectionRoute(
  companyId: string,
  path: string,
): ScopedRoute {
  return { url: path, headers: { "X-Company-Id": companyId } };
}

export function contractRoute(
  companyId: string,
  contractId: string,
  path = "",
): ScopedRoute {
  return {
    url: `/contract${path}`,
    headers: { "X-Company-Id": companyId, "X-Contract-Id": contractId },
  };
}

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname === "/dashboards" ||
    pathname.startsWith("/dashboards/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/**
 * Base RTK Query API service for ContractFlow.
 * Extended with injectEndpoints() in domain-specific service files.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: async (args, baseQueryApi, extraOptions) => {
    const result = await baseQuery(args, baseQueryApi, extraOptions);

    if (result.error?.status === 401) {
      baseQueryApi.dispatch(clearUser());

      if (
        typeof window !== "undefined" &&
        baseQueryApi.endpoint !== "logout" &&
        isProtectedRoute(window.location.pathname)
      ) {
        window.location.replace("/login");
      }
    }

    return result;
  },
  tagTypes: [
    "Auth",
    "User",
    "Workspace",
    "Contract",
    "Onboarding",
    "Company",
    "Dashboard",
    "Admin",
    "CompanyMember",
    "CompanyInvitation",
    "ContractRoleAssignment",
    "ContractLifecyclePermission",
    "ContractPartyInvitation",
  ],
  endpoints: () => ({}),
});
