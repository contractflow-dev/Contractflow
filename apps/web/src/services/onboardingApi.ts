import type {
  CompleteOnboardingResponse,
  OnboardingStatus,
  SubmitProfileRequest,
  SubmitRoleRequest,
} from "@contractflow/contracts-schema";
import { api } from "./api";

export const onboardingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOnboardingStatus: builder.query<OnboardingStatus, void>({
      query: () => ({
        url: "/onboarding/status",
      }),
      providesTags: ["Onboarding"],
    }),

    submitProfile: builder.mutation<OnboardingStatus, SubmitProfileRequest>({
      query: (data) => ({
        url: "/onboarding/profile",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Onboarding", "User"],
    }),

    submitRole: builder.mutation<OnboardingStatus, SubmitRoleRequest>({
      query: (data) => ({
        url: "/onboarding/role",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Onboarding"],
    }),

    completeOnboarding: builder.mutation<CompleteOnboardingResponse, void>({
      query: () => ({
        url: "/onboarding/complete",
        method: "POST",
      }),
      invalidatesTags: ["Onboarding", "Auth", "User", "Workspace"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOnboardingStatusQuery,
  useSubmitProfileMutation,
  useSubmitRoleMutation,
  useCompleteOnboardingMutation,
} = onboardingApi;
