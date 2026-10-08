import type { IGetAppUserResponse } from '@contractflow/contracts-schema';
import { api } from './api';

export interface UserProfile extends IGetAppUserResponse {
  id?: string;
  phoneNumber?: string;
}

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

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCurrentUser: builder.query<UserProfile, { id?: string } | void>({
      query: (params) => {
        if (params && params.id) {
          return {
            url: '/users/me',
            params: { id: params.id },
          };
        }
        return {
          url: '/users/me',
        };
      },
      providesTags: ['Auth', 'User'],
    }),

    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth', 'User', 'Workspace'],
    }),

    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (data) => ({
        url: '/auth/register',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    logout: builder.mutation<LogoutResponse, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'User', 'Workspace', 'Onboarding'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCurrentUserQuery,
  useLazyGetCurrentUserQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} = authApi;
