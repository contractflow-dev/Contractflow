# ContractFlow Redux Toolkit + RTK Query Architecture

This document describes the state management architecture for the **ContractFlow** web application.

---

## 1. What Redux Toolkit Is Used For

Redux Toolkit (RTK) is used strictly for **global client-side application state** that needs to be shared across disparate components, layouts, or pages. 

All server state (caching, data fetching, optimistic updates, and cache invalidation) is managed exclusively by **RTK Query**.

---

## 2. What Belongs in Slices vs RTK Query

| State Type | Where It Belongs | Examples in ContractFlow |
| :--- | :--- | :--- |
| **Client UI State** | Redux Slices (`src/features/*`) | Sidebar open/collapsed, active modal name, theme mode, mobile navigation |
| **App-level Selection** | Redux Slices (`src/features/*`) | Active workspace ID (`activeWorkspaceId`), recent workspaces list |
| **First-time Wizard** | Redux Slices (`src/features/*`) | Active onboarding step, temporary draft role during wizard |
| **Client Identity State** | Redux Slices (`src/features/auth`) | Synchronized user profile flags (`isAuthenticated`), current user summary |
| **Server State / Cache** | RTK Query (`src/services/*`) | Users, companies/workspaces, members, contracts, milestones, compliance records, invoices |

> **Rule:** Never duplicate server data inside a client slice. Use RTK Query queries/mutations and subscribe directly in components.

---

## 3. Directory Layout

```text
apps/web/src/
├── store/
│   ├── index.ts          # configureStore, RootState, AppDispatch
│   ├── hooks.ts          # Typed useAppDispatch, useAppSelector, useAppStore
│   ├── provider.tsx      # Client Component wrapping layout with <Provider>
│   └── README.md         # This architecture documentation
│
├── features/             # Client-side slices
│   ├── auth/             # authSlice, authTypes, selectors
│   ├── onboarding/       # onboardingSlice, onboardingTypes, selectors
│   ├── workspace/        # workspaceSlice, workspaceTypes, selectors
│   └── ui/               # uiSlice, uiTypes, selectors
│
├── services/             # RTK Query API services (code-split)
│   ├── api.ts            # Base createApi with baseQuery, tags, credentials
│   ├── authApi.ts        # /users/me, /auth/login, /auth/logout
│   ├── workspaceApi.ts   # /companies, /companies/:id, members
│   ├── contractApi.ts    # /contract, /contract/:id
│   └── onboardingApi.ts  # /onboarding/*
│
└── lib/                  # Generic utilities (e.g. server-side fetch)
    └── api.ts
```

---

## 4. How to Access State and Dispatch Actions

Use the typed hooks in `@/store/hooks`:

```tsx
'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectSidebarOpen, toggleSidebar } from '@/features/ui';

export function SidebarToggle() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectSidebarOpen);

  return (
    <button onClick={() => dispatch(toggleSidebar())}>
      {isOpen ? 'Close' : 'Open'} Sidebar
    </button>
  );
}
```

---

## 5. How to Use RTK Query Hooks

Endpoints are exported from domain modules in `@/services/*`:

```tsx
'use client';

import { useGetCurrentUserQuery } from '@/services/authApi';
import { useGetWorkspacesQuery } from '@/services/workspaceApi';

export function DashboardHeader() {
  const { data: user, isLoading: isUserLoading } = useGetCurrentUserQuery();
  const { data: workspaces, isLoading: isWorkspacesLoading } = useGetWorkspacesQuery();

  if (isUserLoading || isWorkspacesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <p>Workspaces: {workspaces?.length ?? 0}</p>
    </div>
  );
}
```

---

## 6. How to Create a New Slice

1. Create a folder in `src/features/<feature-name>/`.
2. Define types in `<feature-name>Types.ts`.
3. Create the slice in `<feature-name>Slice.ts` using `createSlice`.
4. Export reducers, actions, and selectors.
5. Create `index.ts` for clean barrel export.
6. Register the reducer in `src/store/index.ts`:

```ts
import { myFeatureReducer } from '@/features/myFeature';

export const store = configureStore({
  reducer: {
    // ...existing
    myFeature: myFeatureReducer,
  },
  // ...
});
```

---

## 7. How to Create a New API Service

All services extend the shared base API using `api.injectEndpoints()`:

1. Create `src/services/<domain>Api.ts`.
2. Import `api` from `./api`.
3. Define request/response types, referencing `@contractflow/contracts-schema` where applicable.
4. Call `api.injectEndpoints({ endpoints: (builder) => ({ ... }) })`.
5. Export auto-generated hooks (`use<EndpointName>Query`, `use<EndpointName>Mutation`).

Example:

```ts
import { api } from './api';

export const complianceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getComplianceRecords: builder.query<ComplianceRecord[], string>({
      query: (contractId) => `/compliance?contractId=${contractId}`,
      providesTags: ['Contract'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetComplianceRecordsQuery } = complianceApi;
```

---

## 8. Where Shared Types Live

- **Shared Domain Enums & Schemas:** Defined in `packages/contracts-schema` (e.g. `EUserStatus`, `ECompanyRole`, `EContractType`, `EContractStatus`, `IGetAppUserResponse`).
- **Client-only State Types:** Placed in `src/features/<feature>/<feature>Types.ts`.
- **API Request & Response DTOs:** Defined in `src/services/<service>Api.ts` extending shared schema interfaces.

---

## 9. Security & Authentication Guidelines

- ContractFlow relies on **secure HTTP-only session cookies** managed by the backend.
- **Never store access tokens or passwords in Redux state or `localStorage`**.
- RTK Query is preconfigured with `credentials: 'include'` so browser cookies are automatically attached to all API queries and mutations.
