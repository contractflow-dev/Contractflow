import type {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { api } from './api';

export interface Workspace {
  id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  countryCode?: string;
  defaultCurrencyCode?: string;
  status: ECompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  companyId: string;
  userId: string;
  companyRole: ECompanyRole;
  jobTitle?: string;
  status: ECompanyUserStatus;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateWorkspaceRequest {
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  email?: string;
  phoneNumber?: string;
  countryCode?: string;
  defaultCurrencyCode?: string;
}

export interface UpdateWorkspaceRequest {
  id: string;
  name?: string;
  legalName?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
}

export const workspaceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<Workspace[], void>({
      query: () => ({
        url: '/companies',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Workspace' as const, id })),
              { type: 'Workspace', id: 'LIST' },
            ]
          : [{ type: 'Workspace', id: 'LIST' }],
    }),

    getWorkspaceById: builder.query<Workspace, string>({
      query: (id) => ({
        url: `/companies/${id}`,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Workspace', id }],
    }),

    createWorkspace: builder.mutation<Workspace, CreateWorkspaceRequest>({
      query: (data) => ({
        url: '/companies',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Workspace', id: 'LIST' }],
    }),

    updateWorkspace: builder.mutation<Workspace, UpdateWorkspaceRequest>({
      query: ({ id, ...patch }) => ({
        url: `/companies/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Workspace', id },
        { type: 'Workspace', id: 'LIST' },
      ],
    }),

    getWorkspaceMembers: builder.query<WorkspaceMember[], string>({
      query: (workspaceId) => ({
        url: `/companies/${workspaceId}/members`,
      }),
      providesTags: (_result, _error, id) => [
        { type: 'Workspace', id: `MEMBERS_${id}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useGetWorkspaceMembersQuery,
} = workspaceApi;
