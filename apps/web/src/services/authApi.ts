import type { IGetAppUserResponse } from "@contractflow/contracts-schema";
import { api } from "./api";

export type UserProfile = IGetAppUserResponse;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber?: string;
  timezone?: string;
}

export interface AuthResponse {
  user: UserProfile;
  message?: string;
}

export interface RegisterResponse {
  message?: string;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<UserProfile, void>({
      query: () => "/users/me",
      providesTags: ["Auth", "User"],
    }),

    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth", "User", "Workspace"],
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (data) => ({
        url: "/auth/register",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Auth", "User"],
    }),

    verifyEmail: builder.mutation<{ message?: string }, { token: string }>({
      query: (data) => ({
        url: "/auth/verify-email",
        method: "POST",
        body: data,
        timeout: 15_000,
      }),
      invalidatesTags: ["Auth", "User"],
    }),

    resendVerificationEmail: builder.mutation<
      { message?: string },
      { email: string }
    >({
      query: (data) => ({
        url: "/auth/resend-verification",
        method: "POST",
        body: data,
      }),
    }),

    logout: builder.mutation<LogoutResponse, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCurrentUserQuery,
  useLazyGetCurrentUserQuery,
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
  useLogoutMutation,
} = authApi;
