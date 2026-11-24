import type {
  AuthMessageResponse,
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateMyProfileRequest,
} from "@contractflow/contracts-schema";
import { api } from "./api";
export type {
  AuthMessageResponse,
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateMyProfileRequest,
} from "@contractflow/contracts-schema";

export type UserProfile = AuthResponse["user"];

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<UserProfile, void>({
      query: () => "/users/me",
      providesTags: ["Auth", "User"],
    }),

    /**
     * The signed-in user's own profile (`PATCH /users/me`): only the fields
     * sent change. The saved profile replaces the cached current user, so
     * names and the time zone update everywhere at once.
     */
    updateMyProfile: builder.mutation<UserProfile, UpdateMyProfileRequest>({
      query: (body) => ({ url: "/users/me", method: "PATCH", body }),
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            authApi.util.updateQueryData("getCurrentUser", undefined, () => data),
          );
        } catch {
          // The form shows the failure; the cached profile is unchanged.
        }
      },
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

    forgotPassword: builder.mutation<AuthMessageResponse, ForgotPasswordRequest>(
      {
        query: (data) => ({
          url: "/auth/forgot-password",
          method: "POST",
          body: data,
        }),
      },
    ),

    // The token travels only in the request body, never in a URL.
    resetPassword: builder.mutation<AuthMessageResponse, ResetPasswordRequest>({
      query: (data) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: data,
      }),
      // The API ends every session of the account.
      invalidatesTags: ["Auth", "User"],
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
  useUpdateMyProfileMutation,
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationEmailMutation,
  useLogoutMutation,
} = authApi;
