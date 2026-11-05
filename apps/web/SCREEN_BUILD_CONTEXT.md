# Account Setup and Company Admin Screens: Build Context

This document is the implementation brief for the ContractFlow screens that take a new user from registration to a company-scoped admin dashboard. It describes the current application and the behavior the screens should implement. It is a UI and integration guide, not a claim that the related backend workflows are already available.

## Goal and flow

Build one coherent onboarding journey:

1. Register an account.
2. Verify the user's email through a server-issued link.
3. Sign in after verification.
4. Create a company.
5. Let the server create the company creator's initial administrator membership.
6. Show the company-scoped admin dashboard.

The API is authoritative for account verification, company membership, and permissions. A frontend route, query parameter, or form value must never grant access or an administrator role.

## Existing application context

- This is a pnpm monorepo. The Next.js application is in `apps/web`; the NestJS API is in `apps/api`; shared identity contracts and enums are in `packages/contracts-schema`.
- The frontend uses Next.js App Router, React Hook Form, Zod, Tailwind CSS, shadcn/ui styling, Redux Toolkit, and RTK Query. Reuse the existing store, base API, hooks, and design tokens rather than adding another client or store.
- The RTK Query base API in `src/services/api.ts` uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`), sends cookies with `credentials: 'include'`, and defines shared cache tags.
- The register route `src/app/auth/register/page.tsx` is implemented as a client-side form. It currently POSTs directly to `/auth/register` and navigates to `/login?registered=1` after success. Its fields include first, middle, and last name, email, phone number, timezone, password, and password confirmation. Its Zod schema mirrors the API create-user DTO. Preserve useful validation and responsive presentation, but use the shared RTK Query API when integrating or refactoring.
- A separate feature-based registration implementation exists in `src/features/auth/components/register-form.tsx` and `src/features/auth/components/register/page.tsx`, with schema in `src/features/auth/registerSchema.ts` and auth endpoints in `src/services/authApi.ts`. These are overlapping registration surfaces with differences in fields and behavior. Choose one route/component as the source of truth; do not build a third parallel registration form. The feature schema includes terms acceptance; the app-route schema currently does not.
- `src/services/onboardingApi.ts` defines onboarding status, profile, role, and completion endpoints. `src/features/onboarding/onboardingTypes.ts` describes onboarding steps. These client contracts do not themselves establish that the API controllers or handlers exist.
- The dashboard routes are implemented: `/dashboards` uses authenticated company context and the company dashboard API; team, contract, and company-profile screens are also present. Treat each frontend route as navigation only—the API remains authoritative for company membership and administrator permissions.
- The dashboard API currently returns company membership and invitation counts, total/active/expiring contract counts, and recently updated contracts. It does not expose company-wide activity or company-document listing endpoints. The activity API is contract-scoped; although the document repository has a company-level query, the `Document` entity currently declares `contractId` as non-nullable while the ERD allows documents without a contract. Verify and reconcile that schema/model contract before enabling company-level document workflows.
- The API's `IdentityModule` registers existing `AppUser`, `Company`, `CompanyUser`, `CompanyInvitation`, and `UserSession` entities. `Company` already contains organization/contact/address/status fields. `CompanyUser` already links a user and company and carries a company role, status, and join metadata.
- The current shared `ECompanyRole` enum contains project, site, HSE, and finance roles, but no company administrator role. `AppUser.isPlatformAdmin` is a distinct global/platform privilege and must not be used to represent company ownership or company administrator access.
- The visible API currently has an app-user profile controller/service. Do not assume auth registration/login/verification, onboarding handlers, company endpoints, dashboard data endpoints, or their guards are implemented just because the frontend API wrappers or data entities exist. Confirm and implement the server contracts before depending on them.

## Routes and screen responsibilities

Use the current App Router route conventions. The paths below are intended routes; confirm and keep navigation consistent if the application has already chosen another canonical path.

| Screen | Route | Responsibility |
| --- | --- | --- |
| Register | `/auth/register` | Collect account details, validate, submit registration, and direct the user to email verification pending state. |
| Verify email | `/auth/verify-email?token=…` | Submit the one-time verification token to the API, show success/failure/expired states, and offer sign-in or resend actions as supported by the API. |
| Verification pending | `/auth/verification-pending` | Explain that a message was sent to a safely displayed email address; allow resend with cooldown and clear success/error states. Do not treat visiting this page as verification. |
| Sign in | `/login` (existing link target) | Authenticate only verified users as required by the API; after login, request authoritative onboarding/company access state and route accordingly. |
| Create company | `/onboarding` or the canonical company setup route | Collect supported company fields and submit once; present loading, field validation, API error, and confirmed success states. |
| Admin dashboard | `/dashboards` or a canonical company dashboard route | Fetch company-scoped dashboard data after authentication and membership authorization. Provide loading, empty, and failure states. |

The current register route navigates to `/login?registered=1`; replace that transition with the verification-pending step only once registration actually initiates verification and the API response provides the destination behavior. Never show “verified” or “company created” based only on a client-side transition.

## Screen requirements

### 1. Account registration

- Reuse the current form layout, responsive two-panel treatment, ContractFlow branding, Tailwind theme tokens, and form conventions where appropriate.
- Keep the backend-compatible fields: first name, middle name (optional), last name, email, phone number, timezone, and password. Confirm required fields against the DTO; middle name is optional, while phone number and timezone remain required.
- Keep email normalization/length and password policy validation aligned with the API (`12+` characters, lowercase, uppercase, number, and symbol). Keep confirmation as a client-only field and omit it from the request body.
- Use semantic labels, accessible field errors, disabled/submitting button state, explicit server errors, and duplicate-submission prevention.
- Decide whether terms acceptance is required from an actual product/legal requirement; the feature schema currently requires it while the route schema does not. Do not silently invent consent requirements.
- Submit through the canonical auth RTK Query endpoint. Do not place passwords or verification tokens in Redux state, persistent storage, URLs beyond the API-issued verification link, or logs.
- On success, show pending-verification messaging. Handle duplicate email and validation responses without losing entered non-secret values.

### 2. Email verification

- Accept only the token supplied by the verification email and send it to the backend verification endpoint. The server must validate expiry and one-time use and update trusted account state.
- Render explicit verifying, verified, invalid/expired, and network/server error states. A successful visual state is shown only after an affirmative API response.
- Do not put the token in Redux or local storage. Avoid rendering it back into the page or including it in error telemetry.
- Provide a resend action only if the backend exposes it; show a neutral response and cooldown so resend behavior does not reveal whether an arbitrary address has an account.
- On successful verification, offer sign-in. Do not automatically infer an authenticated session unless the API explicitly creates one and the client verifies it.

### 3. Company creation

- Gate the screen using authenticated session and backend-reported verified status. The API must enforce both conditions itself, irrespective of frontend routing.
- Build the form from the existing `Company` entity and the final create-company DTO. Existing entity fields include name, legal name, registration number, tax identification number, email, phone number, website, address lines, city, state/region, postal code, country code, currency code, status, and verification timestamp. Do not assume every field should be required or user-editable; define that in the DTO/business requirements first.
- The create-company request must not accept an authoritative creator user ID or administrator role from the browser. The API derives the user from the authenticated request, checks verified status, creates the company and initial membership in one database transaction, and assigns the initial company admin server-side.
- Treat the successful response as the source of the newly created company/membership context. Navigate to onboarding completion or the dashboard only after confirmed creation and any required onboarding status fetch.
- Show field-level DTO errors, duplicate/conflict errors, general API/network errors, loading, and success. Prevent repeated submissions while a request is in flight.

### 4. Company admin dashboard

- Render only after the server confirms the current authenticated user's active membership and company-level permissions. A known company ID is not authorization.
- Scope all queries and cache keys to the active company returned by a trusted API response. Clear/invalidate user/company-scoped cached data on sign-out, company switch, or membership changes.
- Use real API data. Until dashboard endpoints and data are implemented, show an honest empty/coming-soon state or clearly identified development fixtures; do not present fabricated metrics as live operational data.
- Include responsive navigation/header and company identity, account/profile access, and sign-out using existing layout conventions. Add dashboard cards, alerts, contracts, compliance, or activity only when the API provides those data.
- Handle initial loading, empty company state, unauthorized/expired session, forbidden membership, and recoverable API failure distinctly. Redirect only based on authoritative session/onboarding status, not guessed client state.

## API prerequisites and contract decisions

Before wiring the screens, confirm or implement these server operations in the existing NestJS architecture:

1. Register an account and send a verification email.
2. Verify an expiring, single-use token and resend a verification email if supported.
3. Authenticate/logout and expose current-user verification/onboarding status through a protected endpoint.
4. Create a company for the authenticated, verified user and atomically add the initial admin membership.
5. Retrieve companies/memberships accessible to the current user and any active-company context.
6. Return company-scoped admin dashboard data with authorization checks on every request.

Use the existing entities and TypeORM configuration. Do not create duplicate identity/company entities or introduce a second account/company status source. Company creation and initial membership must share one transaction, and the membership table should prevent duplicate `(companyId, userId)` pairs at database level.

Resolve these contract gaps explicitly:

- The screens now call the expected RTK Query routes `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/login`, `POST /auth/logout`, `POST /companies`, and `GET /companies`. These are client expectations, not proof of API availability; the visible API currently has no matching auth or companies controllers. Implement and test these handlers before using the flow outside a mocked frontend.
- The company form submits the current entity's company identity, contact, address, and currency fields. Confirm create-company field requirements and server response shape before locking this client contract.
- Add or define a company-level administrator role in the shared role contract if required. Existing `ECompanyRole` has no admin value. Keep this role distinct from `AppUser.isPlatformAdmin`; never accept the initial role from a browser form.
- The current company entity and membership model do not by themselves establish create/update/list endpoints, a transaction, or access control.
- The current app-user entity includes `emailVerifiedAt`, but the visible entity declaration does not mark it nullable even though unverified accounts need to exist. Confirm the intended schema/migrations before using nullability as the verification test.
- The API DTO and register form must agree on optionality and lengths. In particular, the user entity phone field is length 20 while the registration request DTO allows up to 100.
- The existing auth API type describes register as returning an `AuthResponse`, while the standalone page currently expects only an HTTP success and redirects to login. Agree on whether registration returns a session or requires a separate login.
- The existing `onboardingApi` describes `/onboarding/*` endpoints, but the visible API module does not register an onboarding module. Verify actual API coverage before relying on those calls.

Use NestJS DTO validation, authentication guards/current-user extraction, and explicit authorization checks. Never trust a submitted `userId`, `companyId`, `isPlatformAdmin`, membership role, or frontend verification claim as proof of access. Return safe response DTOs rather than raw entities.

## Frontend implementation guidance

- Keep route entry points under `apps/web/src/app`.
- Put reusable domain form/screen components and types under the existing `apps/web/src/features` structure (for example `features/companies`), not in API/shared packages.
- Add company endpoints with `api.injectEndpoints()` and existing RTK Query tag conventions. Use the `api` from `src/services/api.ts`; do not create a second API client or Redux store.
- Follow established `@/` imports, React Hook Form + Zod patterns, shared theme variables, and shadcn/ui components available in the repository. Do not install duplicate form, validation, HTTP, or state libraries.
- Keep secrets out of Redux. Use HTTP-only cookie authentication as the API's established client configuration intends.
- Reuse the existing register surface and consolidate duplicated schema/submit logic rather than creating another auth flow.

## Suggested implementation order

1. Confirm canonical registration/login/verification routes and reconcile the two existing register implementations.
2. Establish and test the API contracts for registration, verification, login, and current-user status.
3. Implement the verification-pending and verification-result states.
4. Add company creation API/DTO/authorization and the atomic company + initial-admin transaction.
5. Implement the company form and connect post-create navigation to authoritative onboarding status.
6. Add company-scoped dashboard API data and guard behavior, then build dashboard loading/empty/error/success states.
7. Validate keyboard/accessibility behavior and responsive layouts across all screens.

## Acceptance checks

- Registration sends exactly the validated DTO fields and never sends password confirmation.
- API errors and duplicate-email responses are visible and do not produce success navigation.
- A user cannot become verified by opening a frontend route or editing client state.
- Expired, invalid, and already-used verification links have explicit outcomes.
- An unverified or unauthenticated user cannot create a company, even by calling the endpoint directly.
- Company creation creates exactly one company and its initial admin membership atomically; a failure in either write leaves neither record committed.
- The browser cannot choose the creator identity or initial admin role.
- A user cannot access company or dashboard data by guessing its ID.
- Company admin and platform admin are treated as distinct roles.
- Loading, validation, empty, network/API error, forbidden, and success states are covered in tests.
- Run the relevant web and API tests and workspace type/build checks after implementation; report any pre-existing failures separately.
