import { api } from "./api";
import type { IAdminOverviewResponse } from "@contractflow/contracts-schema";

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query<IAdminOverviewResponse, void>({
      query: () => "/admin/overview",
      providesTags: ["Admin"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAdminOverviewQuery, useLazyGetAdminOverviewQuery } =
  adminApi;
