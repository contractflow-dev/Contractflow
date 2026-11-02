import {
  ICreateWorkspaceRequest,
  IUpdateWorkspaceRequest,
  IWorkspace,
  IWorkspaceMember,
} from "@contractflow/contracts-schema";
import { api } from "./api";

export const workspaceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspaces: builder.query<IWorkspace[], void>({
      query: () => ({
        url: "/companies",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Workspace" as const, id })),
              { type: "Workspace", id: "LIST" },
            ]
          : [{ type: "Workspace", id: "LIST" }],
    }),

    getWorkspaceById: builder.query<IWorkspace, string>({
      query: (id) => ({
        url: `/companies/${id}`,
      }),
      providesTags: (_result, _error, id) => [{ type: "Workspace", id }],
    }),

    createWorkspace: builder.mutation<IWorkspace, ICreateWorkspaceRequest>({
      query: (data) => ({
        url: "/companies",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [{ type: "Workspace", id: "LIST" }],
    }),

    updateWorkspace: builder.mutation<IWorkspace, IUpdateWorkspaceRequest>({
      query: ({ id, ...patch }) => ({
        url: `/companies/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Workspace", id },
        { type: "Workspace", id: "LIST" },
      ],
    }),

    getWorkspaceMembers: builder.query<IWorkspaceMember[], string>({
      query: (workspaceId) => ({
        url: `/companies/${workspaceId}/members`,
      }),
      providesTags: (_result, _error, id) => [
        { type: "Workspace", id: `MEMBERS_${id}` },
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
