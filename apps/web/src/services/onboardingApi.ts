import type { ECompanyRole } from '@contractflow/contracts-schema';
import { api } from './api';

export type OnboardingStepName = 'profile' | 'role' | 'workspace' | 'completed';

export interface OnboardingStatus {
  currentStep: OnboardingStepName;
  isCompleted: boolean;
  selectedRole?: ECompanyRole;
  workspaceId?: string;
}

export interface SubmitProfileRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber?: string;
  timezone?: string;
}

export interface SubmitRoleRequest {
  role: ECompanyRole;
  jobTitle?: string;
}

export interface CompleteOnboardingResponse {
  success: boolean;
  message?: string;
  status: OnboardingStatus;
}

export const onboardingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getOnboardingStatus: builder.query<OnboardingStatus, void>({
      query: () => ({
        url: '/onboarding/status',
      }),
      providesTags: ['Onboarding'],
    }),

    submitProfile: builder.mutation<OnboardingStatus, SubmitProfileRequest>({
      query: (data) => ({
        url: '/onboarding/profile',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Onboarding', 'User'],
    }),

    submitRole: builder.mutation<OnboardingStatus, SubmitRoleRequest>({
      query: (data) => ({
        url: '/onboarding/role',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Onboarding'],
    }),

    completeOnboarding: builder.mutation<CompleteOnboardingResponse, void>({
      query: () => ({
        url: '/onboarding/complete',
        method: 'POST',
      }),
      invalidatesTags: ['Onboarding', 'Auth', 'User', 'Workspace'],
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
