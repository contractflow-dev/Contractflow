import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearUser } from "@/features/auth/authSlice";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
});

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
  ],
  endpoints: () => ({}),
});
