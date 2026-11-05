import type {
  AuthMessageResponse,
  AuthResponse,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
} from "@contractflow/contracts-schema";
import { api } from "./api";
export type {
  AuthMessageResponse,
  AuthResponse,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
} from "@contractflow/contracts-schema";

export type UserProfile = AuthResponse["user"];

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

    register: builder.mutation<AuthMessageResponse, RegisterRequest>({
      query: (data) => ({
        url: "/auth/register",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Auth", "User"],
    }),

    verifyEmail: builder.mutation<AuthMessageResponse, { token: string }>({
      query: (data) => ({
        url: "/auth/verify-email",
        method: "POST",
        body: data,
        timeout: 15_000,
      }),
      invalidatesTags: ["Auth", "User"],
    }),

    resendVerificationEmail: builder.mutation<
      AuthMessageResponse,
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
