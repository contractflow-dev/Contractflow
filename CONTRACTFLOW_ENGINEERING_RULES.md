# ContractFlow Engineering Rules

These rules describe how to extend the current ContractFlow codebase. The
repository is the source of truth: inspect existing code and follow the closest
established pattern rather than creating a parallel architecture to match an
illustration in this document.

## 1. Core principles

- Keep changes focused and preserve existing behavior unless a change is
  required.
- Give each module and file a clear responsibility.
- Reuse existing contracts, components, services, repositories, utilities, and
  validation before adding new ones.
- Use explicit TypeScript types and avoid `any`.
- Preserve the established naming, formatting, and testing conventions in the
  affected area.
- Do not move or reorganize unrelated code to make the repository look more
  uniform.

## 2. Workspace structure

ContractFlow is a pnpm workspace. Its current application and package layout is:

```text
apps/
  api/
    src/
      common/
      config/
      modules/
        admin/
        compliance/
        contract/
        cross-cutting/
        delivery/
        financial/
        hse/
        identity/
        mail/
        site-operations/
  web/
    src/
      app/
      components/
      features/
      hooks/
      lib/
      services/
      store/
packages/
  contracts-schema/
  db/
  ui/
infra/
```

Do not assume that packages such as `packages/shared` or `packages/contracts`
exist. Shared API and domain types belong in `packages/contracts-schema`;
reusable UI primitives belong in `packages/ui`. `packages/db/docs` holds the
entity relationship diagram and user stories; it is documentation, not a
workspace package. Add a new workspace package
only when there is a concrete need and wire it into the workspace and consuming
applications.

## 3. Backend architecture

The API is a NestJS application. Its feature modules do not all use identical
internal layouts: some files are directly under a module, while others are
organized into folders such as `controllers/`, `services/`, `repositories/`,
`entities/`, `dto/`, and `interfaces/`.

When extending a module:

- Inspect that module and a closely related module first.
- Keep files in the module's existing layout. For a new module, use the
  clearest applicable existing pattern; do not add duplicate root-level and
  nested implementations of the same responsibility.
- Register controllers, providers, imports, and exports in the module
  definition. Export only providers needed by other modules.
- Avoid circular module dependencies; reconsider boundaries before introducing
  `forwardRef()`.

### Responsibilities

- **Controllers** handle HTTP routing, request context, guards/decorators,
  request DTOs, and response status or cookies. They delegate business
  operations and do not implement business workflows.
- **Services** implement business rules and coordinate operations. Keep
  unrelated responsibilities separate.
- **Repositories** encapsulate reusable or scope-sensitive database queries
  where the module uses repositories. Keep query details out of controllers.
- **Entities** describe persistence and relationships; they do not implement
  HTTP or presentation behavior.

The API architecture test scans application service directories and rejects
TypeORM imports, injection, and direct database operations. Keep persistence
implementation details in repository and database infrastructure files.

The project has a shared generic repository at
`apps/api/src/common/database/repositories/base.repository.ts`. It accepts an
optional scope type and provides scope hooks and scoped CRUD operations. Every
method takes the scope as its first argument, and scope conditions are merged
last so callers cannot override them. Scoped subclasses live beside it:

- `CompanyScopedRepository` filters and stamps `companyId`, and throws when the
  company context is missing. Use it for company-owned rows such as
  `CompanyUser`, `CompanyInvitation`, and `Document`.
- `ContractScopedRepository` filters on `contractId`. When the scope includes
  a `companyId`, it also verifies that the company is a `ContractParty` of the
  contract. Use it for contract-owned rows such as delivery, financial, HSE,
  compliance, and site-operations records.
- `AppendOnlyContractScopedRepository` is for contract-scoped histories that
  must not be updated or deleted, such as contract status history and
  inventory transactions.

Choose the base from the entity's actual ownership columns and relationships.
`ContractRepository` extends `BaseRepository` directly and overrides its scope
hooks to restrict contracts to those where the company is a party. Unscoped
repositories (for example users, sessions, and companies) must be used only
after explicit authorization checks.

Application services must not import or inject TypeORM objects or perform
database queries. They depend on application-level persistence ports; TypeORM
repositories and transaction-context factories implement those ports in the
infrastructure layer. Keep ports focused on the operations a service needs,
and do not add repository layers that merely duplicate existing abstractions.

### Data access and scope

- Enforce authorization in the backend; frontend-supplied company or contract
  IDs are not proof of access.
- Company-scoped routes use `CompanyContextGuard`. It requires an
  `X-Company-Id` header containing a ULID, rejects a `companyId` query
  parameter, rejects a header that differs from a `:companyId` route
  parameter, and verifies active membership in an active company. Controllers
  read the validated value with `@CurrentCompanyId()`; never take the company
  from the request body or query.
- Contract access goes through `ContractAccessService.authorize`, which checks
  company membership, contract party status, the contract workspace, and the
  user's contract role assignment, then returns the contract scope to use.
- Every company- or contract-scoped read and write must enforce the relevant
  scope. Use the existing repository scope hooks or explicit scoped methods.
- A contract may be visible through its company-party relationship rather than
  a direct `companyId` column. Inspect the entity and existing authorization
  flow instead of assuming every contract has direct company ownership.
- Do not bypass scoping through a generic lookup, update, delete, or join.
- Use a transaction for multi-record operations that must succeed or fail as a
  unit. Application services coordinate those operations through the existing
  Unit of Work and transaction context. The infrastructure creates all
  transaction-bound repositories from the same transaction; never expose its
  `EntityManager`, `DataSource`, or `QueryRunner` to a service.

### Entities and schema changes

- Keep entities in their feature's existing `entities/` directory and follow
  the entity's actual database model.
- Do not assume that every entity extends one shared `BaseEntity`. The
  repository includes `BaseCustomEntity` and other entity patterns; reuse a
  base only where the feature already calls for it.
- Use migrations for schema changes. Do not enable TypeORM schema
  synchronization as a substitute for migrations.
- Define relationships and constraints only when they represent real domain
  requirements. Use an explicit junction entity when a relationship has its
  own attributes or lifecycle.

### DTOs and shared contracts

- Validate incoming API data with the validation approach already used by the
  module.
- Keep API-specific request and response DTOs in the module's established DTO
  layout. The repository uses both flat DTO directories and nested
  request/response directories; do not reorganize an existing module solely to
  enforce one layout.
- Put types that are part of the API contract shared by the API and web app in
  `packages/contracts-schema`. Keep TypeORM entities, NestJS providers, and
  framework-specific validation decorators out of that package.
- Export shared package APIs through its existing domain and package entry
  points. Prefer package exports over cross-package deep imports.
- Responses must expose only client-appropriate fields; never expose password
  hashes, raw verification tokens, or internal secrets.

### Authentication and authorization

- Keep authentication (establishing identity) distinct from authorization
  (deciding access).
- Protect routes with the existing guards and use explicit public-route
  metadata only for intentionally unauthenticated endpoints.
- Verify active membership and the required company or contract role before
  granting scoped access.
- Keep platform-administrator privileges distinct from company roles.
- Preserve the existing session and cookie behavior when changing identity
  flows.

## 4. Frontend architecture

The web app uses Next.js App Router with feature-oriented code. Its current
layout includes:

```text
apps/web/src/
  app/          # Routes and layouts
  components/   # Shared application components
  features/     # Feature-specific UI and state
  hooks/
  lib/
  services/     # API clients and feature API operations
  store/        # Redux store setup and shared hooks
```

- Keep routes and layouts in `src/app`.
- Put feature-specific screens, components, state, and hooks in the existing
  feature directory. Current feature names include `auth`, `companies`,
  `company-dashboard`, `contracts`, `admin`, `onboarding`, `invitations`,
  `ui`, and `workspace`.
- Put genuinely reusable application UI in `src/components` or the shared
  `packages/ui` package, following existing usage.
- Follow the established `services/`, Redux Toolkit, and feature-state
  patterns. Do not introduce a second API or state-management architecture.
  RTK Query endpoints are added with `api.injectEndpoints()` in a
  `src/services/*Api.ts` file; import them through the `@/services/...` alias.
- The base query in `src/services/api.ts` sends `X-Company-Id` from
  `workspace.activeWorkspaceId`. Endpoints that must not carry company context
  (authentication, public invitations, onboarding, company listing and
  creation, platform administration) are listed in
  `COMPANY_CONTEXT_EXEMPT_ENDPOINTS`; add new endpoints of that kind there.
- Consume shared transport contracts from `@contractflow/contracts-schema`
  where appropriate. Do not import backend entities or repositories into the
  web app.
- Preserve existing accessibility, responsive behavior, and user-facing
  workflows when changing UI.

## 5. Naming and imports

- Follow the naming and file casing already used in the affected module.
  Existing code includes both kebab-case backend files and established
  camelCase/PascalCase frontend files.
- Use descriptive PascalCase class names and camelCase variables and methods.
- Follow existing enum naming in the relevant domain; shared enums commonly use
  the `E` prefix.
- Do not impose an `I` prefix on every interface. Match the convention of the
  containing module and shared package.
- Use `import type` for type-only imports when consistent with the surrounding
  code.
- Avoid circular imports, duplicate imports, and unnecessary barrel exports.
  Follow configured lint and formatting rules for import ordering.

## 6. Testing and validation

Add or update tests for meaningful behavior changes:

- API unit and integration tests use the API's Vitest setup.
- Web tests use the web app's Vitest setup.
- Cover authorization and company/contract scope boundaries for protected
  data access.
- Test observable behavior and failure cases, not only implementation details.

Use the smallest relevant validation commands, then expand if needed:

- API: `pnpm --filter @contractflow/api test -- <test-selector>`
- API service boundaries: `pnpm --filter @contractflow/api test:architecture`
- API integration: `pnpm --filter @contractflow/api test:integration` (requires
  a PostgreSQL test database)
- API lint/build: `pnpm --filter @contractflow/api lint` and
  `pnpm --filter @contractflow/api build`. Use the build to type-check the
  API; `tsc -p tsconfig.json` also checks spec files, which lack Vitest global
  types and report errors that do not affect the build.
- Web: `pnpm --filter @contractflow/web test -- <test-selector>`
- Web lint/build: `pnpm --filter @contractflow/web lint` and
  `pnpm --filter @contractflow/web build`
- Workspace build: `pnpm build`

Report commands that could not be run and failures accurately; do not describe
unverified behavior as passing.

## 7. AI-assisted implementation checklist

Before changing code:

1. Inspect the relevant feature, tests, module registration, and shared
   contracts.
2. Trace the existing user and data-access flow, including authorization and
   transaction boundaries.
3. Identify reusable code and the closest established pattern.

After changing code:

1. Check imports, types, module registration, and exports.
2. Verify scope enforcement and error behavior.
3. Run focused tests and the relevant lint/build checks.
4. Report modified files, validation results, and any intentional deviations.
5. Leave unrelated worktree changes untouched.

Never invent APIs or architectural abstractions without checking the code.
Prefer the repository's proven structure over rules based on hypothetical
folders, classes, or packages.

## 8. Dependency direction

Use this as a conceptual guide, not a requirement to add a layer where the
existing feature does not use one:

```text
HTTP request
    ↓
Controller
    ↓
Service
    ↓
Repository or established TypeORM access pattern
    ↓
TypeORM and database
```

The governing rule is to make each change fit ContractFlow's real structure,
keep responsibilities clear, and enforce authorization at the backend data
boundary.
