# ContractFlow — UI/UX Assessment

**Date:** 5 November 2026
**Branch inspected:** `feat/docker-setup`
**Scope:** `apps/web`, `packages/ui`, `packages/contracts-schema`, with spot checks of `apps/api` authorization.

## How this assessment was done

This is a **code-level review**. No screens were rendered in a browser, so nothing here is "visually verified". Findings come from reading source files, a type-check (`tsc --noEmit`: passes), and lint (`eslint src`: 6 errors). Contrast ratios were calculated from the hex values in `globals.css`. Responsive findings come from Tailwind breakpoint classes, not from resizing a viewport.

Each issue is marked:

- **Confirmed**: the code shows the problem directly.
- **Needs visual check**: likely, but should be confirmed in a running browser before it is fixed.

### Actual stack (verified)

| Area | Expected | Actual |
|---|---|---|
| Frontend | Next.js App Router | Next.js 16.3.7, App Router, React 19.2 |
| UI components | shadcn/ui | shadcn `base-rhea` style on **Base UI** (`@base-ui/react`), in the shared `packages/ui` |
| Styling | Tailwind | Tailwind v4, CSS-first tokens in `apps/web/src/app/globals.css` |
| State | Redux Toolkit + RTK Query | Yes. One `api` with `injectEndpoints`, and an `X-Company-Id` header taken from the active workspace |
| Forms | — | React Hook Form + Zod in auth, onboarding and profile. Uncontrolled `FormData` or `useState` elsewhere |
| Icons | Lucide React | **Remix Icon** (`@remixicon/react`, set in `components.json`). Lucide is used in only one file |
| Backend auth | — | Global `SessionAuthGuard`, `CompanyContextGuard`, `PlatformAdminGuard`, plus `ForbiddenException` checks in services |

---

## Deliverable 7 — Executive summary

**Overall maturity: early product (about 5.3/10).** The groundwork is better than the surface suggests. There is a semantic token system with light and dark palettes, a shared shadcn component package, one RTK Query client with company-scoped headers, careful auth flows (safe redirects, verification tokens removed from the URL, neutral resend messages, cooldowns), and real authorization on the API. What lets it down is the experience on top of that:

- Navigation and landing logic don't match user roles.
- Contract workflows are developer-shaped forms.
- Several global basics are broken: the body font, persisting the theme, and button contrast.
- The two shells, the confirmation patterns and the status badges each work differently.

### Top 10 problems

1. **Regular members land on an "access required" page after sign-in.** Login always goes to `/dashboards`, and that Overview page is admin-only (UX-01).
2. **On mobile, users can't switch companies.** The switcher is inside the sidebar, and the sidebar is hidden below 768px (UX-02).
3. **First sign-in with no company leads to a dead-end card** instead of onboarding (UX-03).
4. **The create-contract form has 20 flat fields.** It asks for "minor currency units" and "basis points", does no client-side validation, and gives no success feedback (UX-04).
5. **There is no forgot or reset password flow** (UX-05).
6. **Role changes and status changes apply instantly with no confirmation.** An admin can be demoted with one select change (UX-06).
7. **Primary buttons and links fail AA contrast.** White on `#e06328` is about 4.2:1, against a 4.5:1 requirement (A11Y-01).
8. **The body font never loads.** The CSS variable names don't match, so the app renders in the system font (DS-01).
9. **The saved light/dark theme is never re-applied on page load** (DS-02).
10. **The register form breaks the rules of hooks.** It renders nothing on the server, causing hydration risk and 5 lint errors (TECH-01).

### Top 10 improvement opportunities

1. Route users after login based on server-reported state: no company → onboarding, member → contracts, admin → overview.
2. Rebuild contract creation as a guided multi-step form using RHF + Zod, with human units (currency amount, percentages) and a redirect to the new contract.
3. Add a toast system and one `ConfirmDialog` built on `AlertDialog` for every destructive or status-changing action.
4. Introduce a `StatusBadge` with semantic colours for contract, membership and invitation states.
5. Put both shells on `packages/ui/sidebar.tsx`, with a company switcher available at every breakpoint.
6. Split contract detail into tabs (Overview · Parties · Roles · Sites · Signatories · History).
7. Extract the duplicated auth hero panel and the formatting helpers (`formatDate`, `formatLabel`) into shared modules.
8. Fix the global tokens: font variable, theme init script, accessible primary text colour, radius scale.
9. Delete dead code: about 1,000 lines in unused components and a duplicate invitation route.
10. Add `error.tsx`, `not-found.tsx`, per-route `loading.tsx` and page titles.

### Already working well

- **Token architecture.** Semantic `oklch` tokens with light and dark sets, a hero panel that is intentionally fixed-dark, a navy sidebar, and chart and status tokens (`globals.css`).
- **Shared components.** shadcn components live in `packages/ui`, so both apps can consume them.
- **API layer.** RTK Query with tag invalidation. Company context is sent through a header and resolved against server-provided memberships, never trusted from the URL. `?companyId=` is stripped (`CompanyAdminShell.tsx:130-139`).
- **Auth robustness.** Open-redirect protection on login (`login-view.tsx:48-58`), the token is captured once and removed from history (`verify-email-view.tsx:22,40`), resend messages are neutral and have a cooldown, and a failed sign-out shows a warning.
- **Authorization is enforced by the API**, not just hidden in the UI.
- **Some good patterns to copy:** the mobile card list for team members, the `AlertDialog` used for contract role revocation, the shared `DataPagination`, `aria-current` on navigation, and the `motion-safe:` animations in `HeroMetrics`.
- **Test coverage** exists for the shell, sign-out, pagination, API services and company selection.

### Recommended priority

Do Phase 1 first (roadmap below). It is small, fixes broken or blocking behaviour, and several later items depend on it. The token fixes in DS-01, DS-02 and A11Y-01 affect every screen, so they should land before any visual polish.

---

## Deliverable 1 — Application inventory

Status key: **Implemented** = connected to the API with real states · **Partial** = works but key parts are missing · **Placeholder** = renders, no real function · **Missing** = no route.

### Routes found (`apps/web/src/app`)

| Route | Module | Component | Guard | Status |
|---|---|---|---|---|
| `/` | — | redirect → `/login` | none | Implemented |
| `/login` | Auth | `features/auth/_views/login-view.tsx` | none | Implemented (no forgot-password link) |
| `/auth` | Auth | redirect → `/auth/register` | none | Implemented |
| `/auth/register` | Auth | `register-view.tsx` + `components/register-form.tsx` | none | Implemented (hooks bug) |
| `/auth/verification-pending` | Auth | `verification-pending-view.tsx` | none | Implemented |
| `/auth/verify-email?token=` | Auth | `verify-email-view.tsx` | none | Implemented |
| `/onboarding` | Onboarding | `features/onboarding/_views/onboarding-view.tsx` | `RequireAuth` | Implemented (create company only) |
| `/onboarding/complete` | Onboarding | redirect → `/dashboards` | `RequireAuth` | Redirect only |
| `/dashboards` | Company admin | `company-dashboard-view.tsx` | `RequireAuth` + shell, admin-only | Implemented |
| `/dashboards/contracts` | Contracts | `contracts-list-view.tsx` → `ContractsList` | shell | Implemented |
| `/dashboards/contracts/[contractId]` | Contracts | `contract-details-view.tsx` → `ContractDetail` | shell | Implemented |
| `/dashboards/team` | Company admin | `companies/_views/company-team-view.tsx` | shell, admin-only | Implemented |
| `/dashboards/profile` | Company admin | `company-dashboard/_views/company-profile-view.tsx` | shell, admin-only | Implemented |
| `/dashboards/settings` | Company admin | redirect → `/dashboards/profile` | — | Redirect only |
| `/invitations/respond?token=` | Invitations | `companies/_views/invitation-response-view.tsx` | none (public lookup) | Implemented. **This is the URL in invitation emails** |
| `/invitations/accept?token=` | Invitations | `invitations/_views/accept-invitation-view.tsx` | none | **Duplicate / legacy.** Not linked from email |
| `/invitations/contract-party?token=` | Contracts | `contract-party-invitation-response.tsx` | none | Implemented |
| `/invitations/contract-role?token=` | Contracts | `contract-role-invitation-response.tsx` | none | Implemented |
| `/admin` | Platform admin | `admin/_views/admin-overview-view.tsx` | `RequirePlatformAdmin` | Implemented (overview only) |
| `/terms-of-service`, `/privacy-policy` | Legal | `components/legal/*` | none | Implemented (marked as draft) |

### Sections inside contract detail

Role assignments, lifecycle management (edit title/description, workspaces, status transitions, archive), party invitations, signatories, sites, parties table and status history. All of these are **Implemented** and stacked on one page.

### Requested areas with no frontend

| Area | Status | Notes |
|---|---|---|
| Forgot / reset password | Missing | No route, no API wrapper |
| Session expiry UX | Partial | A 401 triggers a hard redirect to `/login` (`services/api.ts:70-79`) with no "session expired" message |
| Profile setup / user profile / account settings | Missing | `onboardingApi.ts` defines profile endpoints, but no UI uses them |
| Company selection | Partial | Native select in the desktop sidebar only |
| Company activity log | Missing | The API has contract-scoped `GET activity`. No UI |
| Contract approval workflows | Missing | Only status transitions (activate / suspend / resume / complete) |
| Contract execution & signatures | Partial | Signatory assignment exists. No signing flow |
| Expiry & renewal | Partial | "Expiring soon" list on the dashboard. No renewal action |
| Documents (list, upload, preview, versions, permissions) | Missing | No API controller and no UI |
| Project / delivery, HSE, Finance, Compliance | Missing (UI) | The API has **read** endpoints (stages, milestones, variations, incidents, inspections, invoices, payments, requirements). No screens. `--dept-*` tokens are defined but unused |
| Notifications, global search, help | Missing | — |
| Error / 404 / loading pages | Missing | No `error.tsx`, `not-found.tsx` or `loading.tsx` anywhere |
| Platform admin modules (12 items) | Placeholder | Shown as disabled "Planned" items in `admin-sidebar.tsx:41-140` |

---

## Deliverable 2 — Audit report

### 2.1 Visual design

- **Typography.** The intended pairing is IBM Plex Sans for body text and Outfit for headings. Because of DS-01, the body falls back to `system-ui`, so headings (Outfit) and body (system) don't match. The `globals.css` header comment also still mentions DM Sans. Sizes are mostly `text-sm`/`text-xs`, with several `text-[11px]`, `text-[10px]` and `text-[9px]` labels: register labels, the admin nav group headers, and "Planned" badges. 9–11px uppercase text is too small for primary labels.
  - **Recommended scale:** 12 (caption) / 14 (body, labels) / 16 (lead) / 18 (section heading) / 24 (page title) / 30 (dashboard hero). Remove the arbitrary sizes below 12px.
- **Colour.** The palette is coherent: orange primary, navy surfaces, neutral greys. Problems:
  - Primary is used as a **text** colour for links throughout, even though `--brand` exists for that purpose (A11Y-01).
  - Status meaning isn't colour-coded. All badges are `outline` (DS-08).
  - The admin area uses raw Tailwind emerald, amber and blue instead of `success`/`warning`/`chart-*` (DS-06).
- **Layout.**
  - Company pages use a 256px fixed sidebar, a sticky header and `max-w-7xl` content with 16/24/32px padding. That is consistent.
  - The admin shell repeats the same structure with different styling (DS-04).
  - Auth pages use a 50/50 split with the form in `max-w-md`.
  - Onboarding squeezes a 13-field form into the same half-width panel, widened to `max-w-2xl`, which makes it cramped at `lg` (UX-16).
- **Visual weight.**
  - The company dashboard has **seven** blocks: 5 KPI cards, two lists, quick actions, a card that only says activity isn't available, profile and access. Some of these repeat each other (profile is shown on the dashboard and has its own page).
  - KPI cards turn navy on hover even though they aren't clickable (DS-11).

### 2.2 Components

shadcn components are used in most places. The deviations are:

- **Native elements in place of components**:
  - Raw `<input type="checkbox">` in 4 places (DS-09).
  - `NativeSelect` used everywhere, including the company switcher and enum filters, while `Select` is used only for the timezone field on register. `NativeSelect` is a reasonable choice for long lists; using both is the inconsistency.
  - `window.confirm` in 3 places (DS-03).
- **Hand-built where a component exists:**
  - The admin mobile drawer (custom `div` overlay, while `Sheet` exists).
  - Two sidebars (while `sidebar.tsx` exists).
  - Text "Loading…" paragraphs (while `Skeleton` and `Empty` exist).
- **Sizes.**
  - Default `Button` and `Input` are 32px tall (`h-8`) and `sm` is 28px.
  - Auth pages override them to 44px (`h-11`).
  - The app therefore has two control heights depending on the area (DS-07).
- **Radius.** `--radius: 0.25rem`.
  - Buttons, inputs and badges use `rounded-2xl` (about 7.2px).
  - Cards use `radius-4xl` (about 10.4px).
  - Auth controls override to `rounded-md` (about 4.4px).
  - Skeletons use `rounded-xl`; admin nav items use `rounded-lg` (4px).
  - The comment in `globals.css` says "inputs and buttons = rounded-md ≈ 8px", which matches none of these.
- **Missing components:** toast/sonner, a status badge, a confirm dialog wrapper, a page header, an empty state wrapper (`empty.tsx` exists but is unused), a stat card, and a breadcrumb in use (`breadcrumb.tsx` exists but is unused).

### 2.3 Navigation and information architecture

- **The company nav has four items** (Overview, Contracts, Team, Company profile). Three are admin-only, so a regular member sees **one** item.
  - The default landing page for everyone is the admin-only Overview (UX-01).
- **Breadcrumbs.**
  - There are none.
  - Contract detail uses a "Back to contracts" text link.
  - A subcontract links to "the parent contract" without giving its name.
- **Account menu.** It contains only name, email and Sign out. There is no profile, account settings or help.
- **Platform admin.** It is only reachable by typing `/admin`. The company shell has no link to it for platform admins, while admin has a "Company Workspace" link back.
- **Admin sidebar.** 12 of its 13 items are disabled "Planned" entries. That is honest, but it makes the product look unfinished to the people who use it most.

### 2.4 Responsiveness (code-level)

| Viewport | Findings |
|---|---|
| 375 / 390 | Register name row is `grid-cols-3` with no breakpoint, so each input is about 100px wide with placeholder-only labels (UX-08). Company switcher unavailable (UX-02). Team invitations and all contract tables rely on horizontal scroll (`table.tsx` wraps in `overflow-x-auto`). The members list has a proper mobile card layout. Default controls (32px) are below the 44px touch guidance (A11Y-04). |
| 768 | Sidebar appears at `md`. Dashboard KPIs go to 2 columns, so 5 cards leave a single orphan card on the last row. |
| 1024 | Auth pages switch to 50/50 at `lg`. The onboarding form drops to 1 column at `lg` (`lg:grid-cols-1`) and back to 2 at `xl`. That's deliberate, but it means a long single-column form. |
| 1440 / 1920 | Content capped at `max-w-7xl` (1280px). The 5-column KPI row works at `xl`. The admin main area also caps at `max-w-7xl`. No issues found. |

### 2.5 Accessibility (WCAG 2.2 AA)

| ID | Issue | Severity |
|---|---|---|
| A11Y-01 | Primary orange text and background contrast is about 4.2:1 | High |
| A11Y-02 | Contracts, contract detail, team and profile pages have no `<h1>`; `<h2>` is used as the page title | Medium |
| A11Y-03 | Inputs have `border-transparent` and a 50% grey fill, so the field boundary is likely below the 3:1 non-text contrast requirement | Medium (needs visual check) |
| A11Y-04 | 28–32px controls. This meets 2.5.8's 24px minimum, but not the 44px guidance for a touch-heavy field workforce | Low |
| A11Y-05 | Register name fields: placeholder used as the label, and the "Full name" text isn't a `legend` | Medium |
| A11Y-06 | Admin mobile drawer has no focus trap, no Escape handling and no `aria-modal` | Medium |
| A11Y-07 | No skip-to-content link in either shell | Low |
| A11Y-08 | Errors shown in plain `Alert` without `role="alert"` in several places, so they may not be announced. Login adds it in one place only (`login-view.tsx:89`) | Low |

Done well: labels are associated through `FieldLabel htmlFor`, `aria-invalid` is set, decorative icons are `aria-hidden`, `aria-current` is on nav links, and `role="status"` is used for loading text.

### 2.6 Data and interaction states

- **Loading.** Three different patterns are in use: skeletons (dashboard, admin), centred text (contracts, detail, session check), and returning `null` (create-contract card, lifecycle card), which makes the page shift once data arrives (DATA-02).
- **Empty.** Messages are present and honest, but they don't suggest a next step. For example, "No contracts match these filters." has no "Clear filters" action, and an empty register has no "Create your first contract".
- **Error.** Errors show the API message with a Retry button in most places. Contract detail treats 403, 404 and 500 the same way (DATA-03).
- **Success.**
  - The team view has inline success messages.
  - Contract lifecycle actions have none (UX-15).
  - Contract creation closes the form silently.
- **Duplicate submission.**
  - Most submit buttons are disabled while a request is in flight.
  - The "Revoke" buttons on contract party invitations (`contract-lifecycle-management.tsx:681-692`) aren't disabled while revoking, so they can be clicked repeatedly.
- **Destructive confirmations.** Inconsistent (DS-03), and missing for role changes and status changes (UX-06).
- **RTK Query usage.**
  - `currentData` is used correctly to avoid showing data from the previous company.
  - `refetchOnMountOrArgChange` is used on the dashboard.
  - Switching company invalidates company-scoped tags.
  - Pagination is kept in range with `useKeepPageInRange`.
  - This is well done.

### 2.7 Role-based and multi-tenant experience

| Check | Result |
|---|---|
| Current company is visible | Yes. The header shows "Company workspace · {name}" (`CompanyAdminShell.tsx:342-345`) |
| Company switching | Desktop only, as a native select with no search. A cramped `max-w-40` class sits inside a 256px sidebar (UX-02) |
| Company data separated | Yes. `X-Company-Id` header, a `key={company.id}` remount, tag invalidation, and the stored selection keyed per user |
| Admins see admin features | Yes, through `membership.canManageCompany` |
| Members see only authorized features | Yes, but their landing page is an access-denied card (UX-01) |
| Client vs contractor interfaces | **Not differentiated.** Contract detail shows "Your party: Contractor/Client", and the sections that appear depend only on API permissions. There is no client view (portfolio, approvals) and no contractor view (my assignments, deliverables). The `--dept-*` tokens for contractor, client PM, HSE and finance are unused |
| Consistent role-specific navigation | Partly. Contract creation is gated on `companyRole === COMPANY_ADMIN` (`contract-lifecycle-management.tsx:136-140`), while navigation uses `canManageCompany`. These are two sources for the same decision (TECH-05) |
| Unauthorized actions handled | Admin routes show an explanation card. API 403 errors become "You do not have permission…" |
| UI hiding isn't the only control | **Confirmed.** Global `SessionAuthGuard` (`identity.module.ts:135`), `CompanyContextGuard` on company, contract-domain, HSE, finance and delivery controllers, `PlatformAdminGuard` on admin, and `ForbiddenException` checks in `contract-access.service.ts` and `contract.repository.ts`. This was a spot check, not a full audit of every endpoint |
| Raw role names shown to users | `data.membership.companyRole` is displayed as a raw enum value (`company-dashboard-view.tsx:407`). The revoke dialog uses the raw role (`contract-role-assignment-management.tsx:570`) |

### 2.8 Benchmark against enterprise CLM and SaaS products

Ironclad, Juro, DocuSign CLM, Linear and Asana were used only as a quality bar:

- **Contract visibility.** These tools make the register the home page, with status chips, owner, counterparty, value and expiry. ContractFlow's register shows reference, title, type, status and end date, but not the **counterparty** or the **value**, which are the two columns contract managers scan for most.
- **Workflow discoverability.** Competitors show "what needs me" first: approvals, signatures, expiring contracts. ContractFlow's dashboard has an expiring list (good). There is no "assigned to me" view for non-admins.
- **Interaction feedback.** Linear and Asana set the standard with optimistic updates, toasts and undo. ContractFlow has none of these.
- **Professional appearance.** The token system and hero imagery are a strong base. Developer-facing copy (UX-11) and made-up hero metrics (UX-12) work against it.

Recommendations below stay within ContractFlow's own documented requirements (`SCREEN_BUILD_CONTEXT.md`). None of them add competitor features for their own sake.

### 2.9 Technical UI quality

- `tsc --noEmit`: **passes**.
- `eslint src`: **6 errors**, 5 in `register-form.tsx` (rules of hooks) and 1 in `theme-provider.tsx` (`any`).
- About 1,000 lines of dead or duplicate code (TECH-02).
- Form handling uses three different approaches (TECH-04).
- `formatDate` and `formatLabel` are reimplemented in 7 places with different time-zone behaviour (DATA-01).
- Redux slices: `ui` (sidebar, modal, themeMode) is almost entirely unused because the shells use local state and theming has its own provider. `auth.setUser` is never called; the user comes from RTK Query. These slices are harmless but misleading, and should either be adopted or removed.
- Server components are underused. Nearly every view is `"use client"` behind a client auth gate. That fits cookie-session auth, but it means no server-side redirects or metadata.

---

## Deliverable 3 — Issue register

Paths are relative to `apps/web/src` unless they start with `packages/` or `apps/`.

### Critical / High

| ID | Module | Screen / component | Description | Sev. | User impact | Root cause | Recommended solution | Files |
|---|---|---|---|---|---|---|---|---|
| UX-01 | Navigation | Login → `/dashboards` | Every user is sent to `/dashboards`, which is admin-only. Members see "Company administrator access required" as their first screen | High | Members think they are locked out | Fixed default redirect. Overview flagged `adminOnly` | After the companies load, route by `canManageCompany`: admin → `/dashboards`, member → `/dashboards/contracts`. Or give members their own overview | `features/auth/_views/login-view.tsx:58`, `features/companies/CompanyAdminShell.tsx:56-62,415-424` |
| UX-02 | Multi-tenant | Company shell | Company switcher only exists in the desktop sidebar (`hidden md:flex`) | High | Users with several companies can't switch on phone or small tablet | Switcher not included in the mobile header | Move the switcher into the header (or a sheet) at every breakpoint. Use `Combobox` once there are more than ~7 companies | `features/companies/CompanyAdminShell.tsx:291,301-314,386-409` |
| UX-03 | Onboarding | First sign-in | A user with no company sees a "No active company" card with a small text link | High | Main first-run path is a dead end | Login doesn't check onboarding or company state | Redirect to `/onboarding` automatically when there are zero active memberships. Keep the card only for suspended or inactive cases, with wording for each | `features/companies/CompanyAdminShell.tsx:225-240` |
| UX-04 | Contracts | Create contract | 20 ungrouped fields. Values entered in "minor currency units" and "basis points". Free-text timezone. No client validation (dates, end after start). Form closes silently on success | High | Data entry errors (×100 value mistakes). Users unsure the contract was created | Form built directly on the DTO with uncontrolled `FormData` | Multi-step RHF + Zod form: Basics → Parties & workspaces → Commercial terms → Dates. Accept decimal amounts and %, convert on submit. Timezone select. Navigate to the new contract with a toast | `features/contracts/components/contract-lifecycle-management.tsx:67-330` |
| UX-05 | Auth | Login | No forgot or reset password route, link or API wrapper | High | Locked-out users have no self-service | Not built | Add `/auth/forgot-password` and `/auth/reset-password?token=` using the verify-email patterns (neutral responses, token removed from the URL). Requires API work | `features/auth/_views/login-view.tsx`, `services/authApi.ts` |
| UX-06 | Team / Contracts | Member role select, status transitions | Changing a member's role saves on `onChange` with no confirmation. Suspend and Complete apply immediately | High | One accidental click demotes an admin or completes a contract | No confirmation pattern | Confirm role changes (especially away from admin) and all status transitions with `AlertDialog`, showing the effect | `features/companies/_views/company-team-view.tsx:377,532`, `features/contracts/components/contract-lifecycle-management.tsx:551-566` |
| A11Y-01 | Design system | All primary buttons, `text-primary` links | White on `#e06328` ≈ 4.2:1, and `#e06328` on white ≈ 4.2:1. Below 4.5:1 for normal text | High | Hard to read for low-vision users. Fails AA | Primary token used as a text colour | Darken primary for light mode (`#c4501a`, the existing `--brand`, is about 5.2:1), or keep the orange for fills only and use `text-brand` for links | `app/globals.css:107,123`, links across `features/**` |
| DS-01 | Design system | Global typography | The layout defines `--font-ibm`; the CSS reads `--font-ibm-plex-sans`. Body text falls back to `system-ui` | High | Font differs across operating systems and doesn't match Outfit headings | Variable name mismatch | Change `variable: "--font-ibm-plex-sans"` in the layout, or update the CSS. Update the stale DM Sans comment | `app/layout.tsx:7-12`, `app/globals.css:15-20` |
| DS-02 | Design system | Theme | `applyTheme` only runs on toggle or storage events. A stored dark preference or system dark mode is never applied when the page loads | High | Dark-mode users get light mode on every reload | No initial theme script | Add a small inline script in `<head>` (before paint) that applies the stored or system theme, and add `suppressHydrationWarning` on `<html>` | `components/theme/theme-provider.tsx:32-60`, `app/layout.tsx:36` |
| TECH-01 | Auth | Register form | `if (typeof window === "undefined") return null` runs before hooks. 5 rules-of-hooks lint errors. The server renders nothing | High | Blank form until hydration, risk of hydration mismatch, fragile under React Compiler | SSR workaround for `Intl.supportedValuesOf` | Remove the early return. Compute timezones in `useEffect` or `useSyncExternalStore`, or render the select only on the client | `features/auth/components/register-form.tsx:55-58` |

### Medium

| ID | Module | Screen / component | Description | Root cause → Solution | Files |
|---|---|---|---|---|---|
| UX-07 | Auth | Register | Terms and Privacy links navigate away and lose the half-completed form. A dialog-based `LegalConsent` component exists but is unused | → Use `LegalConsent` (dialog) in the register form | `features/auth/components/register-form.tsx:311-345`, `components/auth/legal-consent.tsx` |
| UX-08 | Auth | Register | "STEP 1 OF 4" badge but no later screen shows steps 2–4. Name row is `grid-cols-3` at 375px with placeholder labels. Labels like "Email * · Max 254 characters" are noisy | → Remove the badge or add a real stepper across register → verify → company. Stack names on mobile with visible labels. Move limits into helper text or validation | `features/auth/components/register-form.tsx:138-140,151-176,185,213` |
| UX-09 | Auth | Login | No show-password toggle (`PasswordInput` exists). Unverified accounts get a generic error with no resend link | → Use `PasswordInput`. Handle the API's unverified status with a "Resend verification" link | `features/auth/_views/login-view.tsx:113-128` |
| UX-10 | Auth | Verification pending | Doesn't show which address the email went to. User must retype it to resend | → Pass the email through router state or session storage (not the URL), show it masked, and prefill it | `features/auth/_views/verification-pending-view.tsx:16,81-91` |
| UX-11 | Content | Onboarding, dashboard | Developer-facing copy: "The server confirmed company creation", "permissions are assigned by the server", "the current dashboard API does not provide these company-level lists" | → Rewrite for users. Remove the "Activity and company documents" placeholder card until the feature exists | `features/onboarding/_views/onboarding-view.tsx:266,352`, `features/company-dashboard/_views/company-dashboard-view.tsx:329-345` |
| UX-12 | Content | Auth hero | Hard-coded figures ("4.2 Days", "99.8%", "−65%") presented as platform performance. Conflicts with `SCREEN_BUILD_CONTEXT.md`'s rule against fabricated metrics | → Replace with feature statements, or label them clearly as illustrative | `components/auth/HeroMetrics.tsx:9-17` |
| UX-13 | Contracts | Contract detail | Seven or more sections stacked vertically. Editing, status, archive, invitations, roles, signatories, sites, parties and history all on one scroll | → Header with key facts and actions, then tabs. Move archive into a "More" menu | `features/contracts/components/contracts-screens.tsx:352-532` |
| UX-14 | Contracts | Contract list | Create card appears **above** the page heading. Search needs a submit while the filters apply instantly. Only the reference is a link. No counterparty or value columns | → "New contract" button in the page header. Debounce search like the team view does. Make the whole row or the title a link. Add counterparty and value | `features/contracts/components/contracts-screens.tsx:68-76,87-148,197-209` |
| UX-15 | Feedback | Lifecycle, workspaces, invitations | No success confirmation after saving details or workspaces, changing status or inviting a party | → Add a toast system (shadcn `sonner`) and use it app-wide | `features/contracts/components/contract-lifecycle-management.tsx:375-417` |
| UX-16 | Onboarding | Create company | 13 required fields (including tax ID and registration number) on one screen in a half-width panel. No route for invited users, who may not need to create a company | → Ask for the minimum first (name, country, currency, email). Collect the legal details later on the profile page. Add "Were you invited? Check your email" guidance. Confirm with product which fields are legally required at creation | `features/onboarding/_views/onboarding-view.tsx:46-86` |
| DS-03 | Patterns | Destructive actions | `window.confirm` for removing a member, revoking an invitation and archiving a contract. `AlertDialog` for revoking a contract role | → One `ConfirmDialog` built on `AlertDialog` | `features/companies/_views/company-team-view.tsx:161,181`, `features/contracts/components/contract-lifecycle-management.tsx:588`, `features/contracts/components/contract-role-assignment-management.tsx:562` |
| DS-04 | Layout | Company and admin shells | Two hand-built shells with different styling (navy sidebar vs `bg-card`, left-border active state vs filled primary). The admin mobile drawer has no focus trap or Escape handling. `packages/ui/sidebar.tsx` is unused | → One `AppShell` on the shared `Sidebar` (it includes the mobile `Sheet`), configured per area | `features/admin/components/admin-sidebar.tsx:265-283`, `features/companies/CompanyAdminShell.tsx:289-336`, `app/admin/layout.tsx` |
| DS-05 | Layout | Auth hero panel | Copy-pasted 5 times and drifting: different images (`bg-reg-hero` vs `bg-auth-hero`), overlay token vs `bg-black/60`, `text-white` vs `text-hero-foreground`. Login shows an empty `<span>` instead of the brand | → Extract `AuthLayout`/`AuthHero` and use the hero tokens only | `features/auth/_views/login-view.tsx:151-173`, `register-view.tsx:19-40`, `verification-pending-view.tsx:132-153`, `verify-email-view.tsx:133-155`, `features/onboarding/_views/onboarding-view.tsx:115-139` |
| DS-06 | Design system | Admin overview | Raw `emerald-*`, `amber-*`, `blue-*` instead of `success`, `warning`, `chart-*` tokens | → Replace with tokens so dark mode and brand changes apply | `features/admin/components/overview-kpi-grid.tsx`, `contract-lifecycle-card.tsx`, `recent-activity-card.tsx`, `admin-sidebar.tsx:212` |
| DS-07 | Design system | Controls | Two control heights (32px app, 44px auth) and five effective radii. The radius comment doesn't match the values | → Decide one control height (40px recommended for this audience) and one radius scale, set them in the component variants, and remove per-page overrides | `app/globals.css:88-96,102`, `packages/ui/src/components/button.tsx:23-26`, `input.tsx:11`, `features/auth/_views/login-view.tsx:104,120,132` |
| DS-08 | Data display | Status badges | Every status uses `variant="outline"`. Casing is inconsistent (`capitalize` on raw values vs `formatLabel`) | → `StatusBadge` mapping Draft → muted, Active → success, Suspended → warning, Completed → secondary, Archived → outline, Expired → destructive | `features/company-dashboard/_views/company-dashboard-view.tsx:218,273`, `features/contracts/components/contracts-screens.tsx:212,370` |
| DS-09 | Components | Checkboxes | Raw `<input type="checkbox">` in contracts | → `Checkbox` + `Field orientation="horizontal"` | `features/contracts/components/contracts-screens.tsx:150`, `contract-lifecycle-management.tsx:298,492`, `contract-role-assignment-management.tsx:494` |
| DS-11 | Components | KPI cards | `highlight` turns non-interactive cards navy on hover, which suggests they can be clicked | → Make them links to filtered views (for example Expiring → contracts sorted by end date), or remove `highlight` | `features/company-dashboard/_views/company-dashboard-view.tsx:157`, `packages/ui/src/components/card.tsx:21` |
| DATA-01 | Formatting | Dates | `formatDate` is implemented 7 times. The dashboard formats in UTC; contracts format in local time, so the same end date can show as different days | → One `lib/format.ts` (`formatDate` for date-only fields, `formatDateTime`, `formatLabel`, `formatMoney`) | `features/company-dashboard/_views/company-dashboard-view.tsx:437-454`, `features/contracts/components/contracts-screens.tsx:551-558`, and others |
| DATA-02 | States | Loading | Mix of skeletons, text and `return null` (layout shift) | → Skeleton matching each section's shape. Never return `null` while loading a visible section | `features/contracts/components/contracts-screens.tsx:175-181,308-317`, `contract-lifecycle-management.tsx:122,357` |
| DATA-03 | States | Contract detail error | 403, 404 and 5xx handled the same way | → Distinct "No access", "Not found" and "Try again" states | `features/contracts/components/contracts-screens.tsx:319-349` |
| A11Y-02 | Semantics | Contracts, detail, team, profile | No `<h1>`; page titles are `<h2>` | → Shared `PageHeader` rendering an `<h1>` | `features/contracts/components/contracts-screens.tsx:70,366`, `features/companies/_views/company-team-view.tsx:203`, `features/company-dashboard/_views/company-profile-view.tsx` |
| A11Y-03 | Components | Input | `border-transparent` + `bg-input/50`. Boundary likely below 3:1 (needs visual check) | → Visible 1px `border-input` at rest | `packages/ui/src/components/input.tsx:11`, `native-select.tsx:26` |
| A11Y-05 | Auth | Register names | Placeholder used as label. "Full name" is a `span`, not a `legend` | → `FieldSet` + `FieldLegend` with visible labels | `features/auth/components/register-form.tsx:151-176` |
| A11Y-06 | Admin | Mobile drawer | No focus trap, Escape or `aria-modal` | → Use `Sheet` (fixed by DS-04) | `features/admin/components/admin-sidebar.tsx:272-283` |
| RESP-01 | Team | Invitations table | No mobile layout (members have one) | → Reuse the member card pattern | `features/companies/_views/company-team-view.tsx` (invitations section) |
| TECH-02 | Codebase | Dead / duplicate code | Unused: `features/companies/CompanyTeamManagement.tsx` (571 lines), `CompanyProfileEditor.tsx` + `_views/company-settings-view.tsx`, `components/auth/legal-consent.tsx` (until UX-07). `/invitations/accept` duplicates `/invitations/respond`. Most of the `ui` slice and `auth.setUser` are unused | → Remove, or redirect `/invitations/accept` → `/respond`. Adopt or delete the unused slices | listed |
| TECH-04 | Forms | Contracts, team | Three form approaches (RHF+Zod, FormData, `useState` per field) | → RHF + Zod everywhere, sharing schemas with the DTO types | `features/contracts/components/*`, `features/companies/_views/company-team-view.tsx` |
| TECH-05 | Auth (UI) | Create contract gate | Checks `companyRole === COMPANY_ADMIN` through an extra membership query, while the shell uses `canManageCompany` | → Use the `access` object passed from the shell | `features/contracts/components/contract-lifecycle-management.tsx:68,122-140` |
| TECH-06 | App | Errors / 404 | No `error.tsx`, `not-found.tsx` or `loading.tsx` | → Add branded versions at the root and under `/dashboards` | `app/` |

### Low

| ID | Description | Files |
|---|---|---|
| DS-10 | Mixed icon sets: Remix everywhere, Lucide in sign-out. Standardise on Remix (set in `components.json`), or migrate fully to Lucide if that's the team's preference | `components/auth/sign-out-action.tsx:5` |
| TECH-03 | `useTheme` fallback returns the wrong shape (`setTheme` instead of `toggleTheme`) typed `any`, so the toggle silently does nothing outside the provider. Lint error | `components/theme/theme-provider.tsx:107-116` |
| TECH-07 | Generic metadata (`title: "Contractflow"`, description "Contractflow"). No per-page titles, so every tab and history entry looks the same | `app/layout.tsx:26-29` |
| A11Y-04 | 28–32px controls. Raise to ≥40px for touch (part of DS-07) | `packages/ui/src/components/button.tsx` |
| A11Y-07 | No skip link in the shells | `features/companies/CompanyAdminShell.tsx`, `app/admin/layout.tsx` |
| A11Y-08 | Error `Alert`s not announced (no `role="alert"`) | various |
| UX-17 | Account menu has only Sign out. No profile, settings or help; no link to `/admin` for platform admins | `features/companies/CompanyAdminShell.tsx:367-382` |
| UX-18 | A 401 hard-reloads to `/login` with no "Your session expired" message, and doesn't keep the current page as `?redirect=` | `services/api.ts:70-79` |
| UX-19 | Party invitation "Revoke" buttons aren't disabled while a revoke is in flight, and have no confirmation | `features/contracts/components/contract-lifecycle-management.tsx:681-692` |
| UX-20 | Dashboard "Location" shows ", NG"-style text when the city is empty, because the "Not provided" fallback never triggers | `features/company-dashboard/_views/company-dashboard-view.tsx:377` |

---

## Deliverable 4 — Design system assessment

### Existing tokens (`apps/web/src/app/globals.css`)

| Category | What exists | Assessment |
|---|---|---|
| Colour | Full shadcn semantic set plus `field`, `brand`, `navy`, `success(-soft)`, `warning(-soft)`, `hero-*`, `dept-*`, `chart-1..5`, `sidebar-*`. Light and dark | Strong. Gaps: no `info`, no `destructive-soft`, no `destructive-foreground`. `field`, `navy` and `dept-*` are barely used or unused |
| Typography | `--font-sans`, `--font-heading`, `--font-mono` | Broken body font (DS-01). No type scale tokens. Sizes are ad hoc, including 9–11px |
| Spacing | Tailwind default scale. `--card-spacing` per card size | Fine. Page padding (`p-4 sm:p-6 lg:p-8`) is repeated by hand. Move it into a layout component |
| Radius | `--radius` 0.25rem with derived `sm`…`4xl` | Inconsistent use (DS-07). Pick 3 values: control, card, pill |
| Shadow | Tailwind defaults (`shadow-sm` on cards and sidebar, `shadow-2xl` on the drawer) | Acceptable. Not tokenised |
| Breakpoints | Tailwind defaults (`sm/md/lg/xl`). Sidebar at `md`, auth split at `lg` | OK. Document the conventions |
| Z-index | Literal `z-20`, `z-30`, `z-50` | Header 20 and auth bar 30 are inconsistent between areas. Define layers: header, sidebar, overlay, popover, toast |
| Component sizes | Button and input `h-8`/`h-7`/`h-9`, overridden to `h-11` | Unify (DS-07) |

### Component inventory (`packages/ui/src/components`, 47 files)

- **Used:** alert, alert-dialog, avatar, badge, button, card, checkbox, dropdown-menu, field, input, input-group, native-select, select, separator, skeleton, table, textarea, dialog (legal).
- **Available but unused, and useful:** `sidebar`, `sheet`, `breadcrumb`, `empty`, `tabs`, `combobox`, `tooltip`, `progress`, `pagination` (the app has its own `DataPagination`; check whether they overlap).
- **Missing and needed:** toast (`sonner`), `StatusBadge`, `ConfirmDialog`, `PageHeader`, `StatCard`, `AppShell`, `AuthLayout`.

### Standardisation plan

1. **Tokens.** Fix the font variable and theme init. Choose an accessible text colour for brand links. Add `info` and `destructive-soft`. Define a type scale. Settle on 3 radii and 1 control height.
2. **Primitives.** Apply the height and radius decisions inside `button.tsx`, `input.tsx`, `native-select.tsx` and `select.tsx`, then remove page-level overrides.
3. **App-level components** in `apps/web/src/components`: `AppShell`, `AuthLayout`, `PageHeader`, `StatusBadge`, `ConfirmDialog`, `StatCard`, `EmptyState` (wrapping `empty.tsx`), `SectionSkeleton`.
4. **Utilities.** `lib/format.ts` for dates, labels, money and enum display names.
5. **Guardrail.** Add an ESLint rule or review checklist banning raw palette colours (`emerald-`, `blue-`, `bg-black`, `text-white`) outside `packages/ui`.

---

## Deliverable 5 — Workflow assessment

| # | Workflow | Next action clear? | Validation & errors | Progress & recovery | Verdict |
|---|---|---|---|---|---|
| 1 | Registration | Yes | Good Zod rules mirroring the API. Duplicate email → field error | Misleading "Step 1 of 4". Terms links lose data. Server render is blank | **Usable, needs fixes** (TECH-01, UX-07, UX-08) |
| 2 | Email verification | Yes | Explicit states, token removed from the URL, neutral resend | Must retype email to resend | **Good** (UX-10) |
| 3 | First login | No | Generic errors. No unverified handling. No password visibility | No forgot password. Lands on the wrong page | **Broken path** (UX-01, UX-03, UX-05, UX-09) |
| 4 | Onboarding | Mostly | Field-level Zod errors. Country → currency auto-fill (nice) | 13 required fields at once. Success screen copy is technical | **Usable, heavy** (UX-16, UX-11) |
| 5 | Create company | Same as 4 | — | Membership created by the server, admin assigned (correct) | **Works** |
| 6 | Become company admin | Implicit | — | Success screen states it | **Works** (copy only) |
| 7 | Invite members | Yes | Inline error and success | Role list is a raw enum list. Revoke uses `window.confirm` | **Works** (DS-03, DATA-04) |
| 8 | Assign company roles | Yes | Busy state | **No confirmation. Saves on change** | **Risky** (UX-06) |
| 9 | Company dashboard | Admin: yes. Member: **no** | Retry on error | Placeholder card. Repeats profile | **Admin OK / member broken** (UX-01) |
| 10 | Create contract | Hidden behind a card above the heading | **No client validation.** API errors only as one alert | Silent close. No redirect | **Poor** (UX-04, UX-14) |
| 11 | Add contract parties | Inside "Manage contract" → "Invite a company" | Error alert | No success message. Revoke has no confirmation or busy state | **Works, weak feedback** (UX-15, UX-19) |
| 12 | Assign contract responsibilities | Yes | Errors shown. Revoke uses `AlertDialog` (good) | Raw role names | **Good** (DATA-04) |
| 13 | Documents | — | — | — | **Not implemented** |
| 14 | Review contract details | Long scroll | Per-section errors | No tabs or anchors | **Usable, dense** (UX-13) |
| 15 | Lifecycle management | Reason required (good) | Error alert | No confirmation. No success feedback | **Risky** (UX-06, UX-15) |

**Client vs contractor.** Both organisation types use the same screens. What each sees is decided only by API permissions, which is correct for security. Neither gets an interface suited to its job: client project managers need portfolio oversight and approvals; contractors need assignments and deliverables. That design work should wait until the delivery, HSE and finance UIs are planned, because those are where the two roles differ most.

---

## Deliverable 6 — Improvement roadmap

Dependencies are noted as → "needs".

### Phase 1: Critical usability and functional fixes (small, do first)

1. DS-01 font variable · DS-02 theme init script · TECH-01 register hooks · TECH-03 `useTheme` typing. These clear the lint errors.
2. UX-01 route by role after login, and UX-03 automatic onboarding redirect.
3. UX-02 company switcher on mobile (a temporary header placement is fine; the proper version arrives in Phase 3).
4. UX-06 confirmations for role changes and status transitions → needs the `ConfirmDialog` from Phase 2 item 3. Building `ConfirmDialog` first is recommended.
5. A11Y-01 accessible primary text and fills.
6. UX-11 and UX-12: remove developer copy and made-up metrics.

### Phase 2: Visual consistency and design system

1. Token decisions: type scale, radius, control height (DS-07). Apply them inside `packages/ui`.
2. `StatusBadge` (DS-08), `lib/format.ts` (DATA-01, DATA-04), and replace raw palette colours (DS-06).
3. `ConfirmDialog` (DS-03) and toast (UX-15).
4. `AuthLayout` (DS-05) and `PageHeader` with `<h1>` (A11Y-02).
5. Replace native checkboxes (DS-09). Visible input borders (A11Y-03, needs visual check).
6. TECH-02 dead-code removal. Do it early in this phase to reduce merge conflicts.

### Phase 3: Navigation and workflows

1. `AppShell` on the shared `Sidebar` for both areas (DS-04, A11Y-06) → needs Phase 2 item 1.
2. Account menu with profile and settings, plus an admin link (UX-17). User profile page → needs API confirmation.
3. Contract creation rebuild (UX-04, TECH-04, TECH-05) → needs `lib/format.ts` for money and percentages.
4. Contract detail with tabs and header actions (UX-13). Contract list improvements (UX-14).
5. Auth: forgot/reset password (UX-05, needs API), login improvements (UX-09), verification email prefill (UX-10), register fixes (UX-07, UX-08), session-expired message (UX-18).
6. Onboarding simplification (UX-16) → needs a product decision on required fields.
7. Member overview or "My contracts" landing → needs a product decision; it replaces the interim route from Phase 1.

### Phase 4: Accessibility and responsiveness

1. Browser pass at 375 / 390 / 768 / 1024 / 1440 / 1920 to confirm or close every "needs visual check" item.
2. Keyboard-only and screen reader pass (NVDA on Windows) over the 15 workflows.
3. Mobile layouts for tables (RESP-01, the contract register), touch targets (A11Y-04), skip links (A11Y-07), alert announcements (A11Y-08).

### Phase 5: Performance and technical refinement

1. `error.tsx`, `not-found.tsx`, `loading.tsx`, per-page metadata (TECH-06, TECH-07).
2. Consistent loading skeletons (DATA-02) and distinct error states (DATA-03).
3. Decide what to do with the unused Redux slices (`ui`, `auth`, `onboarding`).
4. Consider moving the auth gate into middleware or server components, for server-side redirects and fewer client-only views.
5. Add Playwright smoke tests for the main workflows, so regressions in navigation and state are caught.

---

## Deliverable: Scores

| Area | Score | Reasoning |
|---|---|---|
| Visual design | **6/10** | A coherent palette and good hero imagery, held back by the wrong body font, made-up metrics, uniform outline badges and a dense dashboard |
| Layout consistency | **5/10** | Company pages are consistent with each other. The admin shell and the five copies of the auth hero drift. Mixed radii and control heights |
| Navigation | **4/10** | Wrong landing page for members, no mobile company switcher, no breadcrumbs, a thin account menu, admin hidden behind a typed URL |
| User experience | **4/10** | Auth flows are thoughtful. Contract creation and lifecycle actions are developer-shaped, with missing confirmations and feedback |
| Design system | **5/10** | Excellent token foundation and a shared component package. No type scale, unused components, raw colours, and no shared app-level patterns |
| Responsiveness | **6/10** | Breakpoints are considered and member lists have mobile cards. Switcher missing on mobile, cramped register names, tables scroll sideways. Not visually verified |
| Accessibility | **6/10** | Good labelling and ARIA use. Failing primary contrast, missing `h1`s, and an inaccessible admin drawer |
| Component reusability | **5/10** | Shared UI package used. Formatters, hero, shells and confirm patterns are duplicated. About 1,000 lines of dead code |
| Data presentation | **6/10** | RTK Query states handled carefully, with honest empty states. Inconsistent loading, date time-zone drift, raw enum values |
| Role-based experience | **5/10** | The API enforces access and admin gating works. Members get a poor landing, and there is no client- or contractor-specific UI |
| Technical UI quality | **6/10** | Type-check clean, sensible structure, tests present. 6 lint errors including a real hooks violation, three form approaches, unused slices |
| **Overall** | **5.3/10** | A solid technical base. The priority is fixing landing and navigation logic and making the contract workflows safe and understandable |

---

## What happens next

This report is assessment only. No application code was changed. Remediation should start with Phase 1 once it is approved. Items marked "needs visual check" should be confirmed in a running browser before they are fixed.
