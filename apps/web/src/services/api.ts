import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearUser } from "@/features/auth/authSlice";
import { signInUrl } from "@/features/auth/signInRedirect";
import type { RootState } from "@/store";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const COMPANY_CONTEXT_EXEMPT_ENDPOINTS = new Set([
  "getCurrentUser",
  "login",
  "register",
  "verifyEmail",
  "resendVerificationEmail",
  "forgotPassword",
  "resetPassword",
  "logout",
  "getCompanies",
  "getCurrentCompany",
  "getCompanyAccessSummary",
  "verifyCompanyEmail",
  "createCompany",
  "getPublicCompanyInvitation",
  "respondToCompanyInvitation",
  "getPublicContractPartyInvitation",
  "getPublicContractRoleInvitation",
  "respondToContractRoleInvitation",
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

/** True once the current user has loaded on this page. */
function hadSignedInUser(state: RootState): boolean {
  return Object.values(state.api.queries).some(
    (query) => query?.endpointName === "getCurrentUser" && query.data,
  );
}

// Several requests can fail at once when a session ends; send the user to
// sign in only once.
let redirectingToSignIn = false;

/** For tests: forget that a sign-in redirect has started. */
export function resetSignInRedirectForTests(): void {
  redirectingToSignIn = false;
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
      // Read before clearing: a user who was signed in on this page has had
      // their session expire or be revoked.
      const expired = hadSignedInUser(baseQueryApi.getState() as RootState);
      baseQueryApi.dispatch(clearUser());

      if (
        typeof window !== "undefined" &&
        baseQueryApi.endpoint !== "logout" &&
        isProtectedRoute(window.location.pathname) &&
        !redirectingToSignIn
      ) {
        redirectingToSignIn = true;
        // A full page load, so nothing from the old session stays in memory.
        window.location.replace(
          signInUrl(`${window.location.pathname}${window.location.search}`, {
            expired,
          }),
        );
      }
    }

    return result;
  },
  tagTypes: [
    "Auth",
    "User",
    "Workspace",
    "Contract",
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
