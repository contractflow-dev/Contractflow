import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Base RTK Query API service for ContractFlow.
 * Extended with injectEndpoints() in domain-specific service files.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
    prepareHeaders: (headers) => {
      // Headers can be customized here if needed (e.g. CSRF tokens).
      // Authentication uses secure HTTP-only cookies/credentials per ContractFlow architecture.
      return headers;
    },
  }),
  tagTypes: ['Auth', 'User', 'Workspace', 'Contract', 'Onboarding'],
  endpoints: () => ({}),
});
