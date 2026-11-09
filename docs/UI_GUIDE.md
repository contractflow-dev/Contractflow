# ContractFlow — User Interface Guide

How to build screens in `apps/web` so they look, read and behave like the rest of ContractFlow.

This guide describes the UI **as it is in the code** after the Phase 1–3 remediation (commit `4da40ca`, branch `ui-remeditaion-phase3`). It sits beside two other documents:

- [`CONTRACTFLOW_ENGINEERING_RULES.md`](../CONTRACTFLOW_ENGINEERING_RULES.md): architecture, data access and scope rules. Those rules win wherever the two documents overlap.
- [`docs/UI_UX_ASSESSMENT.md`](UI_UX_ASSESSMENT.md): the findings (UX-, DS-, A11Y-, DATA- and TECH- codes) that this guide's rules came from.

The code is the source of truth. If this guide and a shared component disagree, follow the component and fix the guide.

---

## 1. Stack at a glance

| Area | What we use |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Components | shadcn `base-rhea` style on **Base UI** (`@base-ui/react`), in the shared `packages/ui` package |
| Styling | Tailwind v4, CSS-first tokens in `apps/web/src/app/globals.css` |
| Icons | **Remix Icon** (`@remixicon/react`). Do not add Lucide or another set |
| State and data | Redux Toolkit + RTK Query (`api.injectEndpoints` in `src/services/*Api.ts`) |
| Forms | React Hook Form + Zod v4 (`@hookform/resolvers/zod`) |
| Toasts | Base UI toast, via `notifySuccess` / `notifyError` in `src/lib/notify.ts` |
| Direction | `components.json` sets `rtl: true`: use logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`, `text-end`) instead of `pl-`/`pr-`/`left-`/`right-` |

---

## 2. Where UI code goes

| Kind of code | Location | Import as |
|---|---|---|
| Primitives (Button, Input, Dialog, Sidebar …) | `packages/ui/src/components` | `@workspace/ui/components/<name>` |
| App-wide components (shell, page header, form field, status badge, confirm dialog, pagination, toasts, theme) | `apps/web/src/components/<area>/` | `@/components/...` |
| Feature screens, components, hooks and schemas | `apps/web/src/features/<feature>/` (`_views/`, `components/`, `_hooks/`) | relative or `@/features/...` |
| Routes and layouts | `apps/web/src/app/` (thin: a page renders one view) | — |
| Formatting, errors, toasts, pagination helpers | `apps/web/src/lib/` | `@/lib/...` |

Before building something new, check `apps/web/src/components` and `packages/ui/src/components` first. Change a primitive in `packages/ui` only when the change should apply everywhere (this is how the 40px control height was introduced). Never restyle a primitive one page at a time.

---

## 3. Design tokens

### 3.1 Colour: semantic tokens only

Every colour comes from a token in `globals.css`, which defines both the light (`:root`) and dark (`.dark`) values. Theme switching is one class swap on `<html>`, so a hard-coded colour breaks dark mode.

**Raw Tailwind palette classes (`text-emerald-600`, `bg-slate-100` …) and hex values are not allowed.** `src/app/semantic-colours.test.ts` scans the app and fails the build's test run if it finds one.

| Use | Token classes |
|---|---|
| Page and surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted` |
| Text | `text-foreground`, `text-muted-foreground` (secondary text, captions) |
| Primary action and links | `bg-primary text-primary-foreground`, `text-primary` |
| Brand accents (headings, highlights) | `text-brand`, `bg-brand text-brand-foreground` |
| Borders | `border-border` (dividers, cards), `border-field-border` (form controls) |
| Form fill | `bg-field` / the primitives' `bg-input/50` |
| Focus | `ring-ring` (set by the primitives) |
| Errors and destructive actions | `text-destructive`, `bg-destructive/10 text-destructive-soft-foreground` |
| Status tints | `bg-success-soft text-success-soft-foreground`, and the same for `warning` and `info` |
| Department workspaces | `*-dept-contractor`, `*-dept-client-pm`, `*-dept-hse`, `*-dept-finance` |
| Charts | `chart-1` … `chart-5` |
| Auth hero panel (dark in both themes) | `hero-overlay`, `hero-fade`, `hero-foreground`, `hero-muted`, `hero-accent` |
| Sidebar (dark navy in both themes) | `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border` … |

**Contrast is tested.** `src/app/globals.contrast.test.ts` checks, in both themes:

- primary and brand text: 4.5:1 or better;
- text on fills and hover fills: 4.5:1 or better;
- status-badge text on its soft fill: 4.5:1 or better;
- the resting field border: 3:1 or better.

If you add or change a token, add it to that test.

Two traps to avoid:

- Do not put `text-destructive` on a destructive tint. Use `text-destructive-soft-foreground`, which is tuned for it.
- Do not colour a whole invalid field red. `FormField` keeps typed text in `text-foreground` and colours only the label, the border and the message.

### 3.2 Typography

Fonts:

- **IBM Plex Sans** is the body font (`font-sans`, the default).
- **Outfit** is the heading font (`font-heading`, applied to `h1`–`h4` automatically).
- Both are loaded in `app/layout.tsx`.

Use one utility per text role instead of choosing sizes per screen:

| Role | Utility | Notes |
|---|---|---|
| Screen title (`<h1>`) | `type-page-title` | 2xl, semibold, same size on every viewport. Rendered by `PageHeader` |
| Section title (`<h2>` grouping cards or a table) | `type-section-title` | lg, semibold |
| Heading inside a card or form section | `type-subsection-title` | sm, semibold |
| Small label above a title | `type-eyebrow` | e.g. "Company administration" |
| Paragraph under a title | `type-lead` | sm, muted |

For card titles use `<CardTitle>`, for labels `<FieldLabel>`, for helper text `<FieldDescription>`, and for table text the `<Table>` primitives. Use `tabular-nums` for money, counts and dates in columns.

### 3.3 Radius

`--radius` is 4px, and the shared components set the rest:

- **Controls** (buttons, inputs, selects, badges, menus, popovers): `rounded-2xl` (≈7px).
- **Surfaces** (cards, dialogs, alert dialogs): the primitives' surface radius (≈10px). Bordered panels built by hand, such as empty states and mobile list cards, use `rounded-2xl`.
- **Pills** (avatars, status dots): `rounded-full`.

### 3.4 Control sizes

The shared components set these heights. **Pages don't override them.**

| Size | Height | Use |
|---|---|---|
| `default` | 40px (`h-10`) | Buttons, inputs, selects, input groups, sidebar items |
| `sm` / `xs` | 32px / 28px | Compact rows: table actions, list actions |
| `lg` | 44px | Prominent standalone actions |
| `xl` | at least 44px, label wraps | Full-width calls to action on auth and onboarding screens |
| `icon`, `icon-sm`, `icon-xs`, `icon-lg` | 40 / 32 / 28 / 44px | Icon-only buttons (always give them an `aria-label`) |

Text fields and selects have a visible `border-field-border` at rest (A11Y-03).

### 3.5 Theme

- **Choice:** light and dark, chosen in the theme toggle and saved in `localStorage` under `contractflow-theme`. With no saved choice the system preference is used.
- **Before first paint:** `themeInitScript` (in `<head>`) applies the theme, so there is no flash. Keep it in step with `applyTheme` in `theme-provider.tsx`.
- **Reduced motion:** `prefers-reduced-motion` turns off the app's animations and transitions globally. Don't add motion that matters for understanding.

---

## 4. Layout

### 4.1 Application shell

Every signed-in area (the company dashboards and platform admin) uses **`AppShell`** (`components/app-shell/app-shell.tsx`):

- a fixed sidebar from `md` (768px), which becomes an accessible modal drawer below it (focus trapped, Escape closes it, announced with the area's name);
- a sticky header with the mobile menu button and the area's header content;
- the main content, remounted with `contentKey` when the active company changes so no data from the previous company stays on screen.

Do not build another shell or sidebar. An area supplies:

- `navigationLabel`, which names the `<nav>` and the drawer;
- `brand`;
- an optional `sidebarTop` (the company switcher);
- `navigation` groups;
- `sidebarFooter` (the account menu);
- `header`.

**Navigation items** are `AppNavItem`s (`components/app-shell/navigation.ts`):

- `match: "exact"` for a page that has child routes it shouldn't own, such as Overview at `/dashboards`. The default `section` match keeps "Contracts" active on a contract's detail page.
- `plannedNote` lists a module that isn't built as a disabled item. It never links anywhere.
- Company navigation (`features/companies/company-navigation.ts`) marks items `adminOnly`. They are shown only when the server reports `membership.canManageCompany`.

**Hiding a link is not access control.** The API enforces access; the UI only avoids showing what a user can't use.

The **account menu** (`components/account-menu`) is the one place for account actions: switching between the company workspace and platform administration (for platform administrators), and sign-out. The theme is switched with `ThemeToggle`, not from this menu. Don't add sign-out buttons elsewhere. Screens outside the shell, such as onboarding, use `SignOutAction`.

### 4.2 Landing after sign-in

These paths are defined in `features/workspace/workspaceLanding.ts`. Use the constants rather than writing the paths again.

| User | Lands on |
|---|---|
| Company Administrator (`canManageCompany`) | `COMPANY_OVERVIEW_PATH`, `/dashboards` |
| Company member | `MEMBER_LANDING_PATH`, `/dashboards/contracts` |
| No company yet | `ONBOARDING_PATH`, `/onboarding` |

A `?redirect=` destination wins over these, once `safeRedirectPath` has accepted it as same-origin.

### 4.3 Page structure

Start every screen with **`PageHeader`** (`components/page-header/page-header.tsx`). It renders the screen's only `<h1>`, with an optional `eyebrow` and `description`.

```tsx
<div className="space-y-6">
  <PageHeader
    eyebrow="Company administration"
    title="Team"
    description="Invite people and manage what they can do."
  />
  <section aria-labelledby="members-heading" className="space-y-5">
    <h2 id="members-heading" className="type-section-title">Members</h2>
    …
  </section>
</div>
```

Heading rules (A11Y-02):

- exactly one `<h1>`, and it comes first;
- sections start at `<h2>`;
- never skip a level (`<h1>` → `<h3>`).

`headingProblems(markup)` in `components/page-header/heading-outline.ts` checks these rules in a test. Use it in every new view's test.

Spacing: `space-y-6` between the header and top-level sections, `space-y-5` or `gap-4` inside a section, `gap-3` between controls in a toolbar. Name `<section>`s with `aria-labelledby` pointing at their heading.

Put the heading before the action it relates to. On the contract list, the "New contract" action follows the title, not the other way round.

### 4.4 Responsive behaviour

Every screen is checked at **1280px, 768px, 390px and 375px**, in both themes. The rules:

- **No horizontal page scroll** at any width. Give flex and grid children `min-w-0`, let long text wrap (`break-words`), and give `fieldset`s `min-w-0` (`FormSection` already does).
- **Tables become cards on phones.** Show a `<ul>` of cards below `md` (`md:hidden`) and the table from `md` (`hidden md:block`). See `contracts-screens.tsx`.
- **Card grids** go to two columns only at `lg` (`lg:grid-cols-2`). At 768px the sidebar leaves too little room.
- **Form grids** collapse to one column on phones: use `FormGrid` (`columns={2}` gives `sm:grid-cols-2`).
- **Actions** wrap (`flex flex-wrap gap-2`) rather than overflow.
- **Text that hides at small widths** (such as "Next" in pagination) needs an `aria-label` on its control, so the control keeps an accessible name.

---

## 5. Components: which one to use

| Need | Use | Don't |
|---|---|---|
| A labelled form control | `FormField` from `@/components/forms/form-field` | A bare `<Input>` with a placeholder as its label |
| A group of related fields | `FormSection` (a `fieldset` and `legend`) | A `div` with a bold paragraph |
| A responsive grid of fields | `FormGrid` | Ad-hoc grid classes on each form |
| Password entry | `PasswordInput` (`features/auth/components`), which has show/hide | `<Input type="password">` |
| Choosing from a fixed list | `NativeSelect` (good on mobile, works with RHF `register`) | A custom dropdown for a simple list |
| A checkbox | the shared `Checkbox` | a native `<input type="checkbox">` (DS-09) |
| A record's status | `StatusBadge` | A `Badge` with hand-picked colours |
| Explaining the statuses on a screen | `StatusLegend` | Colour-only keys |
| Confirming a destructive or status-changing action | `ConfirmDialog` | `window.confirm`, or applying it on change |
| Telling the user an action succeeded | `notifySuccess(title, description?)` | An inline banner that never goes away |
| A request failure with nowhere to show it | `notifyError(error, fallback)` | `alert()` or a console log |
| An error tied to a form or section | `<Alert variant="destructive">` inline | A toast |
| Paging through a list | `DataPagination` | Custom prev/next buttons |
| Loading placeholders | `Skeleton`, inside `role="status"` with a label | A spinner on its own |
| Legal text | `LegalDocumentDialog` (opens in place, so the form isn't lost) | A link that navigates away from a half-filled form |
| Sign-in and sign-up screens | `AuthTopBar` and `AuthHero` | A new split layout |

---

## 6. Forms

### 6.1 Fields

Use `FormField` for every control. It provides:

- a visible label tied to the control with `htmlFor`/`id`;
- `aria-describedby` linking the helper text and the error;
- `aria-invalid` and `aria-required` on the control.

Spread the control props it hands you, then `register`:

```tsx
<FormField id="contract-title" label="Title" required error={errors.title?.message}>
  {(control) => <Input {...control} {...register("title")} />}
</FormField>
```

Required and optional markers:

- Pass `required` only when validation really requires the field. It shows an asterisk, which screen readers hear as "(required)".
- A form that uses asterisks shows `<RequiredFieldsNote />` once, above the fields.
- In a form that is mostly required, mark the exceptions `optional` instead.
- Short inline forms, such as a search box or a single email invite, need neither marker.

Use correct input attributes:

- `type` and `inputMode` (`email`, `decimal`, `numeric`);
- `autoComplete` (`email`, `current-password`, `new-password`, `organization` …);
- `spellCheck={false}` for emails and codes.

### 6.2 Validation

- **One Zod schema per form**, beside the feature (for example `features/contracts/create-contract-schema.ts`, `features/auth/registerSchema.ts`). Trim and normalise in the schema (`.trim()`, `.toLowerCase()` for emails).
- **Cross-field rules** (such as password confirmation, or an end date after the start date) use `refine` with the `when` option, so the rule runs before every other field is valid.
- **Reuse shared rules:** passwords use `newPasswordSchema` and `NEW_PASSWORD_RULES`, which match the API's `STRONG_PASSWORD_OPTIONS`.
- **Validate on submit, then revalidate on change**:
  - `mode: "onSubmit"` and `reValidateMode: "onChange"`;
  - for multi-step forms, revalidate through `form.subscribe` rather than `watch`, which the React Compiler lint rejects.
  - Don't validate on blur: an error appearing on blur moves the layout under the pointer and can swallow the click on the button below it.
- **After a failed submit, move focus to the first invalid control** in on-screen order (use `form.getFieldState`). Request focus with a ref plus a counter in state, never by calling `setState` inside an effect.
- **Enter submits.** Every form has a real `<button type="submit">`. In a wizard, "Next" is the submit button for its step.
- **Server errors:**
  - Show a field error next to its field.
  - Show a form-level error in a destructive `Alert` above the fields. Give it `tabIndex={-1}` and focus it when it appears (see `login-view.tsx`), with `key` changed on each attempt so focus returns on a repeat failure.
  - Read the message with `getApiErrorMessage(error, fallback)`. Never show raw error objects or stack traces.

### 6.3 Submitting

- Disable the submit button while the request runs. Set `aria-busy` and change its label ("Signing in…", "Creating contract…"); this also prevents double submits.
- **On success**, either navigate to the result (for example, a new contract opens its detail page) or show a `notifySuccess` toast, and refresh the affected data via RTK Query tags.

### 6.4 Natural units

Users enter values the way they think of them. The form converts them, using `lib/format.ts`:

| User enters | Stored as | Helper |
|---|---|---|
| `1,500,000.50` in the contract's currency | integer minor units | `parseDecimalToMinor` (exact, uses `currencyDigits`) |
| `5` or `2.5` (percent) | basis points | `parsePercentToBasisPoints` |
| A time zone from a list | IANA name | `timeZoneOptions`, `defaultTimeZone` |
| A date (`<input type="date">`) | `YYYY-MM-DD` | `todayAsCalendarDate` for `max` or default values |

Never ask for "minor units" or "basis points" in a label (UX-04).

### 6.5 Long forms

- **More than about 8 fields:** group them into `FormSection`s.
- **A long creation flow:** split it into steps, as in contract creation (Basics → Parties & workspaces → Commercial terms → Dates) and onboarding (three steps).
- **Each step:** validate it before moving on, show where the user is, and keep the values when they go back.

---

## 7. Showing data

### 7.1 Formatting

Format every value through `src/lib/format.ts`, so the same value reads the same everywhere:

| Value | Helper |
|---|---|
| Calendar dates (contract start and end) | `formatCalendarDate` (formatted in UTC, never shifts a day) |
| Timestamps | `formatDate`, `formatDateTime`, `formatTime`, `formatRelativeTime` |
| Days until a date | `daysUntilCalendarDate` |
| Money stored in minor units | `formatMoneyMinor(amount, currencyCode)` (exact, uses the currency's own decimals) |
| Counts, ratios, basis points | `formatNumber`, `formatPercent`, `formatBasisPoints` |
| Enum values (`under_review`, `contract.deleted`) | `humanizeEnumValue` gives "Under review" or "Contract deleted"; it knows acronyms like EPC |
| Missing values | `EMPTY_VALUE` ("—") |

Never show a raw enum string, an ISO timestamp or an unformatted integer amount.

### 7.2 Statuses

Render statuses with `StatusBadge`. It maps each status to a label and a tone:

| Tone | Badge | Statuses |
|---|---|---|
| neutral | secondary | Draft, Planned |
| success | success | Active, Accepted |
| warning | warning | Suspended, Under review, Pending |
| info | info | Completed |
| danger | destructive | Cancelled, Declined, Rejected |
| inactive | outline | Archived, Expired, Revoked, Inactive, Closed |

- **The label always names the status**, so colour is never the only signal.
- **New status values:** add them to `STATUS_PRESENTATION` rather than styling them locally. An unknown value still renders readably, in the neutral tone.
- **Pending invitations past their expiry** are shown as Expired: use `effectiveInvitationStatus`.

### 7.3 Lists and tables

Every list handles four states separately:

1. **Loading.** Show skeletons shaped like the content, inside `role="status"` with an `aria-label` such as "Loading contracts". Show them only on the first load. When refetching, keep the old data and disable pagination (`isFetching`).
2. **Error.** Show a destructive `Alert` with the API's message and a **Retry** button (`refetch`).
3. **Empty:**
   - with no filters, say what will appear and how to get it (an action, or who to ask);
   - with filters, say nothing matched and offer **Clear filters**.
4. **Data.** Show a table from `md` and cards below it, then `DataPagination` (sizes 10, 20, 50, 100, with an `itemLabel` such as "contracts").

Searching, filtering and sorting:

- **Search** is server-side and runs as the user types, debounced by 300ms with `useDebouncedValue`. Pressing Enter in the box submits straight away.
- **Wrap the filters in `<form role="search" aria-label="…">`.**
- **Changing a search or filter resets to page 1.**
- **Label each filter by what it does.** For example, "Show archived contracts only", because the API returns archived contracts only.

### 7.4 Tabs and detail pages

Contract detail sections (Overview, Parties, Roles, Sites, Signatories, History) each have their own URL. Build links with `contractSectionHref(id, section)`. Restricted sections appear only when the API's permissions allow them; the API still enforces access.

---

## 8. Feedback and confirmation

- **Confirm before** anything destructive, or anything that changes status or access: deleting, archiving, changing a status, changing a member's role, revoking an invitation. Use `ConfirmDialog`:
  - keep `open` true while the request runs;
  - on failure, pass `error` so the user can retry or cancel without losing context;
  - set `destructive` for irreversible actions;
  - write the title as the action ("Archive this contract?") and the confirm label as the verb ("Archive contract"), never "OK" or "Yes".
- **Toasts** confirm what the server has already done, or report a failure that has no form to sit next to:
  - successes clear after 5 seconds and errors after 8;
  - at most 3 are shown at once;
  - repeating an identical toast refreshes it instead of stacking.
  - Keep validation inline; never use a toast for it.
- **Inline `Alert`s** are for messages that belong to a place on the page: a form error, a session notice on the sign-in page, a section that failed to load. Use `role="status"` for information and `role="alert"` (or focus) for errors.

---

## 9. Accessibility checklist

Most of this is built into the shared components. Don't undo it.

- **Keyboard:**
  - every action works by keyboard;
  - focus is always visible (the primitives' `focus-visible:ring-3 ring-ring/30`; don't remove outlines);
  - dialogs and the mobile drawer trap focus and close with Escape.
- **Focus management:**
  - after a failed submit, focus the first invalid field or the form error;
  - after changing tabs or sections, focus follows the existing tab pattern.
- **Names:**
  - icon-only buttons have an `aria-label`;
  - toggles describe their action ("Show password" / "Hide password");
  - `<nav>`, `<form role="search">`, `<section>` and drawers are named.
- **Colour:** never the only signal (statuses have labels; errors have text). Text contrast is at least 4.5:1, and control borders and focus indicators at least 3:1.
- **Headings:** follow the rules in 4.3.
- **Live regions:** loading uses `role="status"`; errors that appear after an action are focused or use `role="alert"`.
- **Touch targets:** controls default to 40px. Don't shrink primary actions below 32px.
- **Motion:** the app respects `prefers-reduced-motion`.
- **Privacy in the URL:**
  - never put tokens or email addresses in URLs;
  - auth pages that receive a token remove it from the address bar as soon as the page loads, and set `metadata.referrer = "no-referrer"`;
  - the pending-verification email is kept in `sessionStorage` only and is shown masked (`maskEmail`).

---

## 10. Writing for the interface

- **Sentence case** for titles, buttons, labels and menu items ("Company profile", "Create an account"). Proper nouns and role names keep their capitals ("Company Administrator", "Finance Officer").
- **Name buttons with a verb and an object:** "Invite member", "Create contract", "Send reset link". Avoid "Submit", "OK" and "Click here".
- **Speak to the user** as "you" ("Your session has expired. Sign in again to continue where you left off.").
- **Error messages** say what happened and what to do next. Don't blame the user, and don't show codes or technical detail.
- **Security-sensitive answers stay neutral.** Forgot-password and resend-verification give the same message whether or not the account exists.
- **No developer-facing text, placeholder metrics or "coming soon" numbers** on screen (UX-11, UX-12). If data isn't available, say so or leave the element out.
- **Empty states** explain what will appear and how to get there.
- **Use the product's terms consistently:** contract, party, counterparty, workspace, role, site, signatory, invitation.

---

## 11. Data, scope and permissions in the UI

These are UI-facing consequences of the engineering rules. Read §4 of `CONTRACTFLOW_ENGINEERING_RULES.md` for the full rules.

- **Company and contract IDs never appear in page URLs as query parameters, or in API URLs, params or bodies.** Build requests with `companyRoute`, `companyCollectionRoute` and `contractRoute` from `src/services/api.ts`, which set the `X-Company-Id` / `X-Contract-Id` headers.
  - Contract detail routes such as `/dashboards/contracts/:contractId` are web page paths. They address the screen, not the API.
- **Get the active company from `workspace.activeWorkspaceId`**, resolved against the user's memberships.
- **Decide what to show from server-provided flags** (`membership.canManageCompany`, contract `permissions`, `myRoles`), never from guessed roles. The server enforces access anyway; the UI just shouldn't offer what will fail.
- **An expired session** (a 401 when the user had been signed in) redirects once to sign-in with "Your session has expired", then returns the user to the page they were on.

---

## 12. Testing and verification

Web tests run in Vitest's **node** environment and render with `renderToStaticMarkup`. There is no DOM, so:

- test the rendered markup, labels, ARIA attributes, states and pure logic (schemas, formatting, presentation maps);
- check headings with `headingProblems`;
- remember the markup differences: React renders `inputMode` in camelCase, and RHF-registered selects have no `selected` attribute in server markup;
- verify interactions (focus, Enter, dialogs, the drawer, responsive layout) in a real browser.

Automated guards that must stay green:

| Test | Guards |
|---|---|
| `src/app/semantic-colours.test.ts` | No raw palette colours anywhere in `src` |
| `src/app/globals.contrast.test.ts` | Token contrast in both themes |
| Each view's test with `headingProblems` | One `<h1>`, no skipped levels |

Before marking UI work done:

1. `pnpm --filter @contractflow/web test`, `lint` and `build` all pass.
2. A browser check at 1280, 768, 390 and 375px, in light and dark: no horizontal overflow, the four list states, keyboard flow and focus, and dialogs.
3. For anything role-dependent, check it as a Company Administrator and as a member.

Report what you actually ran. Never describe an unchecked behaviour as verified.

---

## 13. Pull request checklist (UI)

- [ ] Reused existing primitives and app components; nothing duplicated.
- [ ] Semantic colour tokens only; no hex or palette classes; works in dark mode.
- [ ] `PageHeader` with one `<h1>`; headings in order.
- [ ] Every control labelled through `FormField`; required and optional markers correct.
- [ ] Zod schema; validates on submit; focus goes to the first error; Enter submits; no double submit.
- [ ] Values shown through `lib/format.ts`; statuses through `StatusBadge`.
- [ ] Loading, error (with Retry), empty and filtered-empty states.
- [ ] Destructive and status changes confirmed with `ConfirmDialog`; success confirmed.
- [ ] No horizontal scroll at 375px; table becomes cards on phones.
- [ ] No scope IDs in URLs or request bodies; visibility comes from server flags.
- [ ] Copy is in sentence case, user-facing and actionable.
- [ ] Tests, lint and build pass; browser-checked at the four widths in both themes.

---

## 14. Known gaps

These are not yet in the codebase. Don't assume they exist, and don't build parallel versions without agreeing on the approach first:

- **Phase 4 (accessibility and responsiveness):**
  - a full keyboard-only and screen-reader pass;
  - skip links;
  - a review of touch targets and alert announcements across all screens.
- **Phase 5 (polish):**
  - route-level `error.tsx` and `loading.tsx` pages;
  - per-page metadata (the root title is still "Contractflow");
  - consistent loading skeletons on every screen;
  - end-to-end smoke tests.
- **Small inconsistencies to fix when touching the files:**
  - the My Contracts page title uses title case ("My Contracts"); the rest of the app uses sentence case;
  - the `PageHeader` doc comment has a typo ("screen11").
- **Unlinked page:** `/dashboards/my-contracts` exists but is no longer in the navigation. Whether to keep it is an open product decision.
