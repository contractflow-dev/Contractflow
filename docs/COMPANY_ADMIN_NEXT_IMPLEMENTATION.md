# Company Administrator: what's next

**Inspected:** 9 November 2026, branch `company-admin-phase2` (at `d2a7b46`, which includes PR #70).
**Compared against:** *ContractFlow User Story 2.0*, section 2 (Company Administrator, stories 1–18 plus the "Can view" and "Constraint" notes), the ERD in `packages/db/docs`, and `CONTRACTFLOW_ENGINEERING_RULES.md`.

## Summary

The Company Administrator role is mostly built. **12 of the 18 stories are complete** end to end, meaning an API endpoint, a screen that uses it, and tests. The remaining gaps fall into three groups:

1. **Documents (stories 4 and 5).** The contract document API exists, but no screen uses it. Company-level documents can't be stored at all: the code requires every document to belong to a contract, although the ERD says company-level files are allowed.
2. **Incoming contract invitations (story 14).** Another company's invitation can only be answered from its email link. There's no list of incoming invitations in the app.
3. **Seeing role assignments company-wide ("Can view" note, stories 16–18).** Role assignments can only be seen one contract at a time. There's no company-wide view.

**Recommended next step: a Contract documents tab.** It is frontend-only work against an API that is already merged and tested. The other gaps each need a small, approved backend change.

---

## 1. Story-by-story status

| # | Story | API | Web | Status |
|---|---|---|---|---|
| 1 | Create a company account and verify my email | `POST auth/register`, `auth/verify-email`, `companies/verify-email` | Register, check-your-email and verify pages | ✅ Done |
| 2 | Log in and set up my company's profile | `POST companies` | Onboarding (3 steps) | ✅ Done |
| 3 | Update registration number, tax ID, currency, address at any time | `PATCH company/profile` | Company profile page | ✅ Done |
| 4 | Upload and manage **company-level** documents visible across every contract | ❌ `document.contract_id` is `NOT NULL`; only `contract/documents` routes exist | ❌ No screen | ❌ **Missing (needs a schema change)** |
| 5 | Upload a new version while keeping prior versions | ✅ `contract/documents/:id/versions/upload-url` and `…/complete` (contract documents only) | ❌ `documentsApi.ts` exists, but **no component uses it** | ⚠️ **API only** |
| 6 | Create a contract with workspaces; edit info and workspaces any time | `POST contracts`, `PATCH contract`, `PATCH contract/workspaces` | 4-step wizard; lifecycle management on the detail page | ✅ Done |
| 7 | Delete a contract, with confirmation | `DELETE contract` | `ConfirmDialog` in lifecycle management | ✅ Done |
| 8 | Recover a deleted contract with one button | `POST contract/restore` | "Show archived contracts only" and restore in the list | ✅ Done |
| 9 | Read-only navigation through every past and current contract | `GET contracts`, `GET contract`, parties, status history | Contract list and detail tabs | ✅ Done, as explicit **Company Administrator read-only oversight** (11 Nov 2026; see §8). Workspace and protected data are withheld without a role |
| 10 | Create a contract as a subcontract (`parent_contract_id`) | `parentContractId` in the create DTO | Parent contract picker in the wizard | ✅ Done |
| 11 | Create and manage contract sites | `contract/site-management`, `POST/PATCH contract/sites` | Sites tab | ✅ Done |
| 12 | Record my company's signatory | `GET/PATCH contract/parties/signatory` | Signatories tab | ✅ Done |
| 13 | Invite another company to a contract | `POST contract/party-invitations` (+ list, revoke) | Parties tab | ✅ Done |
| 14 | Accept or reject a contract invitation from another company | `POST contract-party-invitations/preview` and `…/respond` (by email token) | `/invitations/contract-party` (from the email link only) | ⚠️ **Email link only; no in-app list of incoming invitations** |
| 15 | Invite a new team member by email with a company role | `company/invitations` (create, list, revoke) | Team page | ✅ Done |
| 16 | Assign a member to a contract with a workspace role | `POST contract/role-assignments`, `contract/role-invitations` | Roles tab | ✅ Done (per contract) |
| 17 | Give a department lead Workspace Admin rights | `PATCH contract/role-assignments/:id/workspace-admin` | Roles tab | ✅ Done |
| 18 | Revoke a contract role or Workspace Admin rights | `DELETE contract/role-assignments/:id` | Roles tab | ✅ Done (per contract) |

**"Can view" note:** "every COMPANY_USER **and role assignment** at my company, outgoing invitation records, company-level documents".

| Item | Status |
|---|---|
| Members and company invitations | Visible on the Team page |
| Role assignments | Only one contract at a time. **No company-wide view** (no endpoint, no screen) |
| Outgoing contract-party invitations | Only one contract at a time, on each contract's Parties tab |
| Company-level documents | Missing (story 4) |

**Constraint:** "company admin rights don't grant workspace access to any specific contract". The code enforces this. `ContractAccessService.authorize` refuses workspace access to a Company Administrator without a contract role, and `contract-access.service.spec.ts` tests it. Any new work must keep this.

**Contract visibility (since 11 Nov 2026, §8):** company membership alone no longer shows a contract. Ordinary members see only contracts they hold an active role on. Company Administrators keep read-only oversight of every contract their company is party to: list, detail, parties, status history and the enabled-workspace list only. Oversight is never a workspace or protected-resource grant.

---

## 2. Other findings from the inspection

- **Contract activity feed is unused.** `GET contract/activity` (merged) has no web client. The contract History tab shows only status changes (`contract/status-history`).
- **Workspace modules are read-only in the API.** Delivery (stages, milestones, variations), financial (invoices, payments), HSE, compliance and site operations (daily logs, inventory) have `GET` routes only, and no web screens. That work belongs to the workspace-role stories (personas 3–11), not this role.
- **Not implemented for anyone yet:**
  - **Messages, notifications and comments:** entities exist in `cross-cutting/entities`, but there are no controllers.
  - **Two-step verification, session management and user profile:** not started. These are common stories, so they belong in their own phase.
- **The overview dashboard is thin.** `GET company/dashboard` returns counts plus expiring and recently updated contracts. It shows no contracts needing attention, no incoming invitations, and no compliance expiries.
- **Unlinked page:** `/dashboards/my-contracts` and the `assignedToMe` API filter are still in the code but not in the navigation. This is an open decision from Phase 3.

---

## 3. Recommended order

### Step 1: Contract documents tab (stories 5 and partly 4). Frontend only, no approval needed

> **Status: done (9 Nov 2026, uncommitted).** A Documents section on every contract, with upload, new versions with history, download and confirmed delete. It was browser-checked against a throwaway S3 gateway, 27/27 checks in both themes at 1280, 768, 390 and 375 px. Answer to the access question below: a Company Administrator with no role on the contract gets HTTP 403, so the tab explains that documents are for the contract team.

**Why first:** the API is merged, has unit and integration tests, and already handles upload links, versions, downloads, deletion, visibility and per-workspace categories. Only the screen is missing.

- Add a **Documents** section to `features/contracts/contract-sections.ts`, alongside Overview through History.
- **List:** title, category, visibility, current version and updated date, with loading, error, empty and pagination states (see `docs/UI_GUIDE.md` §7.3).
- **Upload flow:**
  1. request an upload URL (`upload-url`);
  2. upload the file straight to object storage;
  3. call `complete`.
- **New version:** the same three-step flow on an existing document; show version history.
- **Download:** request a short-lived link (`download-url`) and open it.
- **Delete:** with `ConfirmDialog`.

Points to settle while building:

- **Administrator access.** `DocumentService` authorises through the contract's `general` workspace. Check whether a Company Administrator without a role can list and upload, and show the API's 403 as a clear state rather than an error.
- **Local storage.** Uploading needs the S3-compatible service from PR #67. Confirm that local development and the browser check have MinIO (or similar) running with CORS set for direct browser uploads.

### Step 2: Company-level documents (story 4). Needs backend approval

> **Status: implemented (9 Nov 2026, uncommitted). API and database approved.**
>
> **Visibility decision (product):** company-wide documents are private to the owning company. Sharing a contract never grants access to another company's library.
>
> | Rule | Enforced by |
> |---|---|
> | 1. Company-wide documents: members of the owning company only | `DocumentService` company methods; repository queries require `contract_id IS NULL` and the owner company; CHECK `ck_document_company_level_private` |
> | 2. "All parties" contract documents: role holders of every party company | Existing contract visibility query, now proven by integration test |
> | 3. "Your company only" contract documents: the uploading company only | Same |
> | 4. Archived contracts: readable, read-only | New `ContractAccessService.authorizeIncludingArchived`, used only by documents; writes return 409 |
>
> - **Migration `1793500000000-company-level-documents`:**
>   - makes `document.contract_id` nullable;
>   - adds the CHECK above;
>   - adds the partial index `IDX_document_company_level_active (owner_company_id, created_at)`.
>
>   Rollback refuses to run while any company-wide documents exist, including soft-deleted ones. Up, guarded down, down and re-up were all checked on a throwaway database.
> - **Endpoints `company/documents`:** list, get, upload link, new-version link, complete, download link and delete, behind `CompanyContextGuard`.
>   - **Reads:** any active member.
>   - **Writes:** Company Administrators, re-checked inside each write's transaction.
>   - **Other companies' documents and contract documents:** they return 404 here.
> - **Storage keys:** `companies/{company}/documents/{document}/{version}.{ext}`. Keys are an address only; every access is authorized from the database first.
> - **Audit:** `activity_log.contract_id` is NOT NULL, so company-document events go to the application log. A company-level audit trail needs a separate decision on that table.
> - **Web:** a "Company documents" page (`/dashboards/documents`), shown in every member's navigation.
>   - It reuses the Documents tab, now generalised, and `lib/presignedUpload.ts` unchanged.
>   - Members can read; administrators add, replace and delete.
>   - There is no "Shared with" choice.
> - **Tests:**
>   - unit tests for the archived and company rules;
>   - PostgreSQL integration test `document-access.integration.spec.ts` with the real `ContractAccessService` (5 scenarios);
>   - web component and API route tests.

- **Migration:**
  - make `document.contract_id` nullable, as the ERD specifies;
  - add a check that company-level documents use owner-only visibility, or decide that they're visible to every counterparty, which is what "visible across every contract" suggests.
- **Endpoints:**
  - company-scoped routes such as `GET/POST company/documents`, `…/:documentId/versions/upload-url`, `…/download-url` and `DELETE`;
  - guarded by `CompanyContextGuard` and limited to `canManageCompany` for writes;
  - the company is taken from the header only (engineering rules §3).
- **Reads from contracts:** decide how a counterparty sees a company's documents through a shared contract (for example, an insurance certificate). This is an access rule that must be approved before it's built.
- **Web:** a "Company documents" item in the admin navigation, with the same list, upload and version screen as step 1, reusing its components.

### Step 3: Incoming contract invitations in the app (story 14). Small backend change

> **Status: implemented (9 Nov 2026, uncommitted). No migration:** it uses the existing `ix_contract_party_invitation_target_status` index.
>
> - **`GET company/contract-invitations`:**
>   - lists pending, unexpired invitations addressed to the header company, on contracts that aren't archived;
>   - Company Administrators only.
> - **`POST company/contract-invitations/:invitationId/respond`** with `{ decision: "accept" | "reject" }`.
>   - The invitation is looked up only among those addressed to the header company, so any other company gets 404.
>   - It runs the same checks as the email link, through one shared method:
>     - the user is a Company Administrator;
>     - the company is still verified and its email matches;
>     - the company isn't already a party;
>     - the invitation has expired or been used → 409;
>     - the contract is locked before the invitation.
> - **Web:** an "Invitations to contracts" card on the Overview, shown only when there's something to answer. Accepting and declining each ask for confirmation.
>   - The planned "count on the Contracts page" was left out: the Overview card covers the story.
> - **Tests:** PostgreSQL integration test `contract-incoming-invitations.integration.spec.ts`:
>   - only the addressed company sees an invitation;
>   - other companies, the inviter and non-administrators are refused;
>   - accepting is final;
>   - rejecting adds no party;
>   - expired invitations and those on archived contracts are hidden.
>
>   Plus web component tests. The existing lifecycle unit tests for the email-token flow still pass.

- **Endpoint:** `GET company/contract-party-invitations?direction=incoming`, or a dedicated route. It lists pending invitations where `target_company_id` is the header company.
- **Responding:** add an in-app accept/reject route keyed by invitation ID and authorised by membership, alongside the existing email-token flow.
- **Web:**
  - an "Invitations to contracts" card on the Overview;
  - a count on the Contracts page;
  - reuse of `contract-party-invitation-response.tsx` for the decision.

### Step 4: Company-wide role assignments ("Can view" note, stories 16–18). Small backend change

> **Status: implemented (9 Nov 2026, uncommitted).**
>
> - **Migration `1793500000001-company-role-assignment-index`:** partial index `ix_contract_role_assignment_company_active (company_id, assigned_at) WHERE revoked_at IS NULL`.
>   - It changes no data, so rollback just drops the index.
>   - Up, down and re-up were checked, and the query planner uses the index.
> - **`GET company/role-assignments?page&limit&companyUserId&workspace`:** Company Administrators only.
>   - It returns active roles held through the company's *own* party, on contracts that aren't archived.
>   - Never another company's roles, even on a shared contract.
>   - There's no contract filter, because contract IDs never go in the query string.
> - **Revoking** reuses the existing per-contract `DELETE contract/role-assignments/:id`. Its checks still apply, including keeping at least one workspace administrator.
> - **Web:** a "Contract roles" section on the Team page.
>   - Member and workspace filters.
>   - A table on desktop and cards on phones.
>   - Links to each contract's Roles section.
>   - Revoke with confirmation.
>   - The member filter lists up to the API's page limit of 100 active members.
> - **Tests:** PostgreSQL integration test `contract-company-role-assignments.integration.spec.ts`:
>   - revoked roles, roles on archived contracts and the other company's roles on the shared contract are excluded;
>   - the filters and paging work;
>   - non-administrators and other companies' administrators are refused.
>
>   Plus service unit tests and web component tests.

- **Endpoint:** `GET company/role-assignments`, paginated and filterable by member, contract and workspace. It is read-only and scoped to the header company's own `company_user` rows.
- **Web:** a "Contract roles" view on the Team page that shows each member's roles across contracts, with revoke and Workspace Admin actions that link to or reuse the existing per-contract mutations.
- **Also useful when removing a member:** show which contract roles will end.

### Step 5: Contract activity in the History tab. Frontend only

> **Status: implemented and browser-checked (10 Nov 2026, uncommitted). No API or database changes.**
>
> - **What the History tab shows:** the existing **Status history** card, unchanged, and below it a new **Activity** card. The Activity card is a timeline of `GET /contract/activity`, with the contract and company in the `X-Contract-Id` / `X-Company-Id` headers, as for every contract route.
>   - Each entry shows a readable label (for example "Site added"), a category badge (Contract, Documents, Roles, Parties, Sites or Signatories), the summary the API wrote, who acted, and the date and time.
>   - Entries are newest first and paged like the rest of the app.
>   - An action the API adds later still reads as words, never as its raw identifier.
> - **Why two cards, not one merged timeline:**
>   - The two lists are paged separately on the server, so merging them would order entries wrongly across page boundaries.
>   - They have different access rules. Status history needs company membership on a party company; activity also needs an active contract role.
>   - Status history covers every party company; activity covers only the caller's own company.
> - **No duplicates:** every status change is also written to the activity log as `contract.status_transitioned`.
>   - The timeline leaves those entries out, and status history stays the record of status changes.
>   - When a page leaves some out, a note says how many, so the page count stays honest.
> - **States:** a loading skeleton; an error with Retry that never shows server error text; an empty state; and, on HTTP 403 (no contract role), an explanation that activity is for the contract team.
>   - Each card makes its own request, so either card still works if the other fails.
> - **Caching:** a new `getContractActivity` query in `contractApi.ts`, through `injectEndpoints` and `contractRoute`.
>   - Company and contract are part of its cache key, and it reads `currentData`, so switching company or contract never shows the previous entries.
>   - It shares the contract's cache tag with status history and refetches when the tab opens.
> - **Shared type:** `ContractActivityItem` in `@contractflow/contracts-schema` (cross-cutting). It matches the fields the API returns.
> - **Files:**
>   - new: `features/contracts/components/contract-activity.tsx` and its test, and `contracts-schema/.../activity-api.interface.ts`;
>   - changed: `contractApi.ts`, `contracts-screens.tsx` (History section), `contract-details-view.tsx` (passes the viewer), the cross-cutting index, and the section tests.
> - **Checks run (10 Nov 2026):**
>   - Web tests: 478 run, 477 passed. The one failure is the `login-view.test.tsx` wording test, which was already failing before this step.
>   - The new `contract-activity.test.tsx` has 14 tests: labels, categories, actor, time, missing fields, no duplicates, loading, error, Retry, 403, empty, long text and large pages.
>   - Web lint (no errors), type check and production build pass.
>   - **API scoping, checked against a throwaway database (8/8):**
>     - each company sees only its own entries on a shared contract;
>     - the response contains no IP address, user agent, request ID, change set or metadata;
>     - a Company Administrator without a contract role gets 403;
>     - a header company the caller doesn't belong to gets 403;
>     - a contract the caller's company isn't a party to gets 404;
>     - a contract with no activity returns an empty page.
>   - **Browser (44/44)**, in light and dark themes at 1280, 768, 390 and 375 px:
>     - direct load and refresh;
>     - status history first and unchanged;
>     - status changes not repeated, with the note;
>     - connectors aligned, no horizontal overflow, long text wraps;
>     - keyboard pagination with a visible focus ring;
>     - "You" for the viewer's own actions;
>     - the 403 explanation;
>     - empty, loading (skeleton, status history still usable) and error states, and Retry;
>     - switching contract, and switching company on a shared contract, with no stale entries in any captured frame.
> - **Limitations and API gaps:**
>   1. ~~**No actor names.**~~ **Resolved 10 Nov 2026** (Step 5.1 below).
>   2. ~~**No filters by date, user or action.**~~ **Resolved 10 Nov 2026** (Step 5.2 below).
>   3. ~~**No link to the changed record.**~~ **Addressed at section level 10 Nov 2026** (Step 5.3 below). Entries link to the contract section that lists their record; linking to the record itself is still not possible, for the reason below. `entity_id` is a generated UUID, and the real record ID is in `metadata`, which the API keeps internal.
>   4. ~~**Read-scoping isn't covered by an automated test.**~~ **Resolved 10 Nov 2026**; see "Activity authorization integration tests" below.
>   5. **Company-level document events aren't in the activity log**, because each entry needs a contract (see the open items).

> **Activity authorization integration tests (10 Nov 2026, uncommitted).** No production code changed.
>
> - **File:** `apps/api/test/integration/contract/contract-activity-access.integration.spec.ts`. It has 24 tests.
> - **What runs for real:** the tests send real HTTP requests to `GET /api/contract/activity`, with the same global prefix and validation pipe as `main.ts`.
>   - The global `SessionAuthGuard` checks real sessions created by `SessionService` in PostgreSQL.
>   - `CompanyContextGuard`, `ContractContextGuard`, `ContractAccessService` and the company-scoped `ActivityLogRepository` all run as written.
>   - Only `AuthService`'s mail, password and registration dependencies are empty stand-ins, because `authenticate` never uses them.
> - **Scenarios covered:**
>   - **Company isolation on a shared contract:** each party receives only its own entries. Swapping the company header gets 403. Pages and totals never include the other company's entries. A user in both companies gets each company's entries under its own header, alternating between them.
>   - **Contract roles:** allowed with an active role. Refused (403) for a Company Administrator without a role, a member without a role, a member whose role is on another contract, a revoked role and a member who left the company. An unrelated company gets 404 with its own header and 403 with the party's header. An archived contract is 404.
>   - **Authentication and context:** no session, an unknown session or a signed-out session gets 401. A missing or malformed `X-Company-Id` or `X-Contract-Id` gets 400. `companyId` or `contractId` in the query string gets 400. Other query parameters can't widen the results.
>   - **Privacy:** each entry had exactly `id, action, entityType, entityId, summary, actorUserId, occurredAt`; Step 5.1 adds `actorName`. No IP address, user agent, request ID, change set, metadata, company or contract ID, user ID or email is returned. The actor appears only as the membership ID and, since Step 5.1, a name.
>   - **Pagination:** the requested page and limit with exact meta, newest first, and totals limited to the company. Five of another company's entries change nothing. An empty contract returns the standard empty structure. Out-of-range `page` and `limit` get 400.
> - **Proof the tests catch a leak:** with the repository's company filter temporarily removed, 7 of the 24 failed. The file was then restored, and git shows no difference.
> - **Results, with `TEST_DATABASE_URL` on a throwaway PostgreSQL 17 database (`contractflow_test_integration`):**
>   - New file: 24/24 pass.
>   - Contract integration folder: 48/48.
>   - Full integration suite: 75 passed, 3 skipped. The skipped ones are the S3 tests, which run only when `TEST_S3_BUCKET` is set.
>   - API unit tests: 427 passed, 20 skipped.
>   - Architecture test: 3/3.
>   - `oxlint`: no warnings.
>   - API compile with `tsconfig.build.json`: clean. It wrote to a scratch folder, because `nest build` deletes `dist`, which the running dev API uses.
> - **Still open from this step:** links to individual records. Actor display names (1) were added in Step 5.1, server-side filters (2) in Step 5.2, and links to each entry's section (3) in Step 5.3.

> **Step 5.1: actor names on contract activity (10 Nov 2026, uncommitted). No migration needed.**
>
> - **Response contract:** each entry gains `actorName: string | null`, the actor's "First Last", in the shared `ContractActivityItem` type and the API's `ActivityFeedItem`.
>   - The existing seven fields are unchanged. `actorUserId` stays, because the timeline compares it with the viewer's membership to show "You".
>   - No email, user ID or other user field is returned.
> - **How names are resolved without crossing companies:** `ActivityLogRepository.findPageWithActorNames` replaces the generic `findPage` call. It is one scoped query, plus TypeORM's count.
>   - It runs through `createScopedQueryBuilder`, so the contract and company scope and the party check still apply.
>   - It left-joins the actor's membership only `ON actor.company_id = activity.company_id`, a company the scope already fixes to the caller's. Then it joins that membership's user, selecting only `id`, `first_name` and `last_name`.
>   - An entry whose actor isn't a membership of the caller's company can never resolve, even if the row is inconsistent.
>   - There's no per-entry lookup (no N+1), and paging and newest-first order are unchanged.
>   - `ActivityService` only maps the name: "First Last", trimmed, the same format as the admin activity feed. It imports no TypeORM.
> - **Unresolved actors:** `actorName` is `null` when the actor doesn't resolve within the caller's company or has no name. The request never fails because of it.
>   - A member who later left the company is still named, because the membership row remains.
>   - Deleting a user can't orphan an entry, because `activity_log.actor_user_id` references `company_user` with `ON DELETE NO ACTION`.
> - **Web:** the timeline shows "You" for the viewer's own entries and the resolved name for everyone else. Without a name, it shows "A member of <company>".
>   - Labels, badges, summaries, times, pages, and the loading, empty, error, Retry and 403 states are unchanged. No new colours.
> - **Tests:**
>   - **PostgreSQL integration (`contract-activity-access.integration.spec.ts`), 32/32.** These are the 24 existing tests, with the privacy test updated to the eight fields, plus 8 new ones:
>     - every entry is named;
>     - each party sees its own actors' names and never the other's;
>     - a person in both companies is named through the header company's membership;
>     - an entry pointing at another party's member resolves to `null`, and that name never appears;
>     - the same for an unrelated company's member, whose user ID also never appears;
>     - an actor with no name resolves to `null` without failing the request;
>     - a member who left is still named;
>     - names are correct on every page.
>   - **Leak checks, each restored afterwards:**
>     - removing the repository's company filter makes 12 of the 32 tests fail;
>     - removing the join's `actor.company_id = activity.company_id` condition makes exactly the two cross-company actor tests fail.
>   - **API, against a throwaway PostgreSQL 17 database (`contractflow_test_integration`):**
>     - contract integration: 56/56;
>     - full integration suite: 83 passed, 3 skipped (the S3 tests, which run only with `TEST_S3_BUCKET`);
>     - unit tests: 427 passed, 20 skipped, including the updated `activity.service.spec.ts` with the name, the `null` fallback and no email;
>     - architecture test: 3/3;
>     - `oxlint`: clean;
>     - compile with `tsconfig.build.json`: clean, written to a scratch folder so `apps/api/dist` stays untouched.
>   - **Web:**
>     - `contract-activity.test.tsx` covers "You", names, and the company fallback for `null`, empty or blank names;
>     - contract tests: 123/123;
>     - full suite: 478 passed, 1 failed (the `login-view.test.tsx` wording test, which was already failing);
>     - type check passes;
>     - lint: no errors, and the one warning (the unused `cn` in `CompanyAdminShell.tsx`) was already there.
>   - **Browser check (10 Nov 2026): 32/32**, in light and dark themes, with no defects found.
>     - **Setup:** a throwaway PostgreSQL database, the current API build on port 3201 and a production web build on port 3202. The data was created through the real API, plus four fixture rows for a long name, a blank name and an inconsistent cross-company actor.
>     - **Actors, at 1280, 768, 390 and 375 px:**
>       - the viewer's own entries show "You";
>       - a colleague shows by name;
>       - a 75-character name wraps without overflowing;
>       - the blank-name actor and the cross-company actor both show "A member of Acme Energy", and the other company's name never appears;
>       - each actor matches its own entry, newest first, below the status history.
>     - **Isolation:**
>       - a member of both companies sees the right names in each company;
>       - switching to Bravo shows only Bravo's actors, with no Acme names in any captured frame;
>       - Bravo's admin sees "You" and no Acme actors.
>     - **Regression (1280 and 390 px):** page 2 shows correct actors in order; the 403, loading, error with Retry, and empty states all still work.
>     - The screenshots were reviewed.
> - **Still outstanding after 5.1:** date, user and action filters (done in Step 5.2), and links to the affected records.

> **Step 5.2: server-side activity filters (10 Nov 2026, uncommitted). No migration.**
>
> - **API contract:** `GET /api/contract/activity` with the existing session, `X-Company-Id` and `X-Contract-Id`, plus these optional query parameters beside `page` and `limit`:
>
>   | Parameter | Meaning | Validation |
>   |---|---|---|
>   | `fromDate` | Entries at or after this point (inclusive) | `YYYY-MM-DD`, or an ISO 8601 instant that names its zone (`…Z` or `±hh:mm`). Real calendar dates only (`@IsDateString({ strict: true })`). An instant without a zone gets 400. |
>   | `toDate` | Entries at or before this point (inclusive) | As `fromDate`. If it's earlier than `fromDate`, 400 with "The activity start date must not be after the end date." |
>   | `actorUserId` | One acting company membership: the `actorUserId` already in the entries | ULID format, like the status-history `userId`; otherwise 400 |
>   | `action` | One action | One of the shared `CONTRACT_ACTIVITY_ACTIONS` (`@IsIn`); otherwise 400 |
>
>   - The names follow the status-history filters (`fromDate`/`toDate`) and the existing response field (`actorUserId`).
>   - The shared types are `ContractActivityFilters`, `ContractActivityAction` and `ContractActivityActor` in `@contractflow/contracts-schema`. The API DTO is `ListContractActivityRequestDto`.
>   - Response fields and privacy are unchanged.
> - **New: `GET /api/contract/activity/actors`.** Same guards and the same `ContractAccessService.authorize(…, 'general')`. It returns `{ actorUserId, actorName }[]`: the members of the caller's company who have activity on the contract, and nothing else about them. It feeds the member filter, because no existing endpoint could list them safely.
> - **Dates and time zones:**
>   - A calendar day is read as that UTC day, from `T00:00:00.000Z` to `T23:59:59.999Z`, as the status-history filter reads it.
>   - An instant is used exactly as given.
>   - The web app always sends instants: the first and last millisecond of each chosen day in the viewer's profile time zone, which handles clock-change days.
>   - The comparison is on `activity_log.occurred_at` (`timestamptz`). The schema is unchanged.
> - **Actors:**
>   - `actorUserId` is a membership ID, not a user ID.
>   - The condition is added to the company-scoped query, so it can only narrow. A member of another company, or an unknown ID, returns the standard empty page rather than revealing whether it exists. A malformed ID gets 400.
>   - A person in two companies gets only the entries of the membership in the header's company.
> - **Actions:**
>   - The 23 values are the actions the services actually write. `contract.updated` had appeared only in tests, so it isn't listed.
>   - A unit test (`activity-actions.spec.ts`) scans every API service file and fails if the list and the written actions ever differ.
>   - The web app's labels are unchanged. Its action dropdown leaves out `contract.status_transitioned`, which belongs to status history.
> - **Repository:**
>   - `ActivityLogRepository.findPageWithActorNames` now takes the filters. They are added as conditions after `createScopedQueryBuilder`, which applies the contract scope, the company scope and the party check. Count and page come from the same filtered query, in newest-first order with `id` as the tiebreaker.
>   - `findActors` is one grouped query that joins only memberships `ON actor.company_id = activity.company_id`, capped at 500.
>   - There's no per-entry lookup (no N+1).
>   - `ActivityService` only validates dates and maps results, with no TypeORM.
> - **Web:**
>   - **Layout:** a compact row of From, To, Member and Action fields (`Field`, `Input type="date"`, `NativeSelect` with category groups), using the contract register's responsive grid: 4 columns, then 2, then 1.
>   - **Applying filters:**
>     - The two dates share one 400 ms debounce, so a range sends one request. Clearing a date applies at once.
>     - The selects apply immediately.
>     - Every change returns to page 1, and paging keeps the filters.
>     - An end before the start is shown under the fields (`role="alert"`, `aria-invalid`) and not sent.
>   - **Feedback:** a "Filtered: …" summary (`aria-live`) with Clear filters, and a filtered-empty state with Clear filters, separate from "No activity yet".
>   - **Out-of-order responses:** RTK Query's `currentData` belongs to the exact arguments, so a slow, older response can't replace newer results.
>   - **Member list:** requested only after the activity has loaded (never after a 403), with names and "(you)".
> - **Performance:**
>   - Everything is filtered in PostgreSQL, one page at a time.
>   - `activity_log` has no index beyond its primary key, as before this step. These queries are still bounded by contract and company.
>   - If activity volumes grow, the index to add is `(contract_id, company_id, occurred_at DESC)`, which also serves the actor and action filters. It was not added, to avoid a speculative migration.
> - **Tests, all run 10 Nov 2026:**
>   - **PostgreSQL integration (`contract-activity-access.integration.spec.ts`): 54/54.** The 32 earlier tests still pass. One was updated, because `actorUserId` is now a real filter rather than an ignored parameter. 22 are new:
>     - **Dates:** start, end, inclusive boundaries, combined ranges, whole UTC days for calendar dates, zoned instants, and rejection of malformed, impossible, zone-less and reversed dates.
>     - **Actor:** a chosen member with names intact, a person in two companies, another company's or an unrelated member, an unknown ID, and malformed IDs.
>     - **Action:** each action, unsupported values, and no cross-company results.
>     - **Combined:** all three filters with paging and exact meta; the standard empty structure; and filters that can't widen access (401, 403 and 404 still apply, and query-string scope IDs still get 400).
>     - **Actor options:** each actor listed once by name, another company's members never listed, the header company only, and the same access rules.
>   - **Leak checks:** removing the company filter made 23 tests fail; removing the actor-options join condition made its guarding test fail. The code was restored.
>   - **API:**
>     - contract integration: 78/78;
>     - full integration suite: 105 passed, 3 skipped (S3 tests, which need `TEST_S3_BUCKET`);
>     - unit tests: 433 passed, 20 skipped, including the action-sync test and the service tests for day bounds, instants, reversed ranges and actors;
>     - architecture test: 3/3;
>     - `oxlint`: clean;
>     - compile with `tsconfig.build.json`, to a scratch folder: clean.
>   - **Web:**
>     - `contract-activity.test.tsx`: 27 tests, 12 of them new: labelled controls and options; members requested only after loading and never on a 403; member and action sent at once on page 1; filters kept while paging; dates sent after the pause as whole days; range error; naming and clearing one or all filters; filtered-empty; controls kept while loading; and the helpers.
>     - `format.test.ts`: `dayBoundsInTimeZone` covers Lagos, UTC, London's spring change, New York's autumn change and invalid days.
>     - Contract tests: 135/135.
>     - Full suite: 493 passed, 1 failed (the `login-view` wording test, which was already failing).
>     - Type check passes; lint has no errors and the one existing warning; the production build passes.
>   - **Browser (44/44, light and dark):**
>     - **Layout:** 4, 2 and 1 columns at 1280, 768, 390 and 375 px, with no overflow and only Acme's members listed (Bravo's admin never).
>     - **Filters, at 1280 and 390 px:** member, then member and action, sent and shown; a filter change returns to page 1; dates sent once after typing, as Lagos whole days; paging keeps the dates; the range error; filtered-empty with Clear filters; Tab reaching all four controls with a focus ring.
>     - **Out-of-order responses:** a deliberately slowed response for an earlier filter never replaced the newer results.
>     - **Company isolation:** Bravo's context lists only Bravo's member.
>     - The screenshots were reviewed.
>   - **Fixed during verification:**
>     - "Clear filters" kept sending the old dates until the debounce ended; clearing now applies at once.
>     - From and To were debounced separately, so a range sent two requests; they now share one debounce.
> - **Still outstanding from Step 5 after 5.2:** links to the affected records (done at section level in Step 5.3).

> **Step 5.3: links from activity to the related records (10 Nov 2026, uncommitted). Web only: no API, shared-contract or database change.**
>
> - **What the data allows:**
>   - Every activity writer stores a random UUID in `entity_id`, keeping the record's real ID in `metadata`, which the API doesn't return.
>   - `entityType` is `contract` for nearly every lifecycle event, including sites, signatories and invitations.
>   - The contract tabs have no existing way to open or highlight a single record.
>   - So entries link to the **section of the open contract that lists their record**, chosen by `action`. This needs no API change, and `entityId` is never used.
> - **Destinations:**
>
>   | Actions | Link |
>   |---|---|
>   | `contract.site_created`, `contract.site_updated` | Open Sites → `/dashboards/contracts/:id/sites` |
>   | `contract.signatory_recorded` | Open Signatories → `…/signatories` |
>   | `contract.party_invitation_created` / `_revoked` / `_accepted` / `_rejected` | Open Parties → `…/parties` |
>   | `contract.role_assigned` / `role_revoked` / `role_invitation_created` / `role_invitation_revoked` / `workspace_admin_granted` / `workspace_admin_revoked` | Open Roles → `…/roles` |
>   | `document.upload_initiated` / `upload_completed` / `upload_failed` / `version_added` / `downloaded` | Open Documents → `…/documents` |
>
> - **Not linked, on purpose:**
>   - `contract.deleted`, `contract.restored`, `contract.workspaces_removed` and `contract.status_transitioned`: their record is the contract that is already open.
>   - `document.deleted`: the file no longer exists.
>   - Any action not in the shared list.
>   - A web test fails if a new action is added without a decision here.
> - **Authorization:**
>   - The link is built only from the current contract and a fixed map, so it can't point to another contract or company.
>   - Links to the restricted tabs (Roles, Sites, Signatories) appear only when that tab is offered to the viewer, using the same `useContractSectionAccess` results.
>   - That is presentation only. Each destination loads its records through its own guarded API (`CompanyContextGuard`, `ContractContextGuard`, `ContractAccessService` and the scoped repositories), unchanged.
>   - A typed URL is refused as before. Browser check: a member without those tabs gets **403** from `contract/site-management` and `contract/parties/signatory`, and the Sites URL shows "This section isn't available to you". Another company's admin who edits the URL to an Acme-only contract gets **404** and "Contract was not found".
> - **Web:**
>   - Linked entries show an "Open <Section>" link with an arrow below the actor and time. Its accessible name is "Open <Section>: <action label>". It uses the existing link style (`text-primary`, underline on hover).
>   - Summary, actor, time and badge are unchanged.
>   - **Keeping the view:** following a link leaves the History tab, so its filters and page are saved per company and contract in `sessionStorage` and restored on return.
>     - A saved value is a convenience only: it is checked again on read, malformed data is ignored, and the API still validates it.
>     - `usePagination` gained an optional starting page; `initialPaginationState` takes an optional page.
> - **Tests (10 Nov 2026):**
>   - **Web:**
>     - `contract-activity.test.tsx` has 36 tests, 9 of them new: every recorded action has a decision; restricted tabs only with access; Documents and Parties always; correct href, accessible name and text, never from `entityId`; unlinked entries without destination or access; summary, actor, time and badge kept; the view restored per company and contract; the view saved; malformed saved views ignored; and no storage needed.
>     - `pagination.test.ts` covers the starting page.
>     - Contract, lib and hook tests: 208/208.
>     - Full suite: 502 passed, 1 failed (the `login-view` wording test, which was already failing).
>     - Type check passes; lint has no errors and the one existing warning; the production build passes.
>   - **API (no change, checked for regressions on a throwaway PostgreSQL 17 database):**
>     - activity integration: 54/54;
>     - contract integration: 78/78;
>     - full integration suite: 105 passed, 3 skipped (S3);
>     - unit tests: 433 passed, 20 skipped;
>     - architecture test: 3/3;
>     - `oxlint`: clean;
>     - compile to a scratch folder: clean.
>   - **Browser (28/28, light and dark):**
>     - **Links, at 1280, 768, 390 and 375 px:** each entry links to its section of the open contract, or has no link (Document deleted, contract-level entries); no overflow.
>     - **Following links, at 1280 and 390 px:**
>       - "Open Sites" opens the contract's Sites tab;
>       - Back keeps the member filter;
>       - a focused link shows a focus ring and opens with Enter;
>       - Back keeps page 2.
>     - **Access:** a member without the restricted tabs gets no links to them, and the API refuses them. Another company's admin can't reach an Acme-only contract by URL.
>     - The screenshots were reviewed.
> - **Still outstanding:** links to an individual record, opened or highlighted inside its section. This needs the API to return the record's real ID in a privacy-reviewed way, and each section to support a deep link. Neither exists today.

Planned as: show `GET contract/activity` alongside status history, with filters by date, user and action. This also covers the Client Project Manager's "audit trail" story.

### Step 6: A richer Company Overview. Optional; needs a small dashboard API extension

> **Status: implemented to the "first-time owner's dashboard" mockup (9 Nov 2026, uncommitted).** API extension approved. Planned modules are shown disabled, as decided.
>
> - **API:** `GET company/dashboard` now also returns `portfolioHealth` and `departments`. They come from one parameterised query in `ContractPartyRepository.getCompanyPortfolioCounts`, limited to the company's own contracts that aren't archived. Invoices also require the company to be the issuer or the payer.
>
>   | Figure | Definition |
>   |---|---|
>   | Stalled contracts | Active, with no status change, contract update or milestone update in 14 days |
>   | Non-compliant contractors | Distinct contractor or subcontractor companies (not your own) with an expired, rejected or non-compliant record |
>   | Payments overdue | Unpaid invoices past their due date; draft, rejected, paid, cancelled and void invoices are excluded |
>   | Contractor | Compliance records needing attention (also includes renewal due) |
>   | Client PM | Contracts needing attention: suspended, stalled, or ending within the expiry window |
>   | HSE | Open incidents (open or in progress) |
>   | Finance | Unpaid invoices due within 30 days. A count, so mixed currencies are never added together |
>
>   These read 0 until the HSE, finance and compliance modules record data, which is true rather than made up. No migration was needed.
> - **Web:**
>   - **Overview:**
>     - a greeting by time of day in the user's time zone;
>     - welcome copy for a first-time owner;
>     - portfolio health and department workspaces (marked "Workspace planned", with no links);
>     - quick actions: "Create a contract" opens the contract form at `/dashboards/contracts#new-contract`; "Invite your team" shows member and invitation counts; "Configure contract stages" is shown as planned;
>     - recent activity, with a "No contracts yet" empty state;
>     - contracts ending soon.
>   - **Sidebar:** grouped as in the mockup. Tasks, Calendar, Reports, the four department workspaces and Help & Support are disabled "Planned" items. "Company profile" plays the role of the mockup's "Settings".
>   - **Not built:** a notifications bell, since notifications aren't built.
>   - **Removed from the Overview:** the company profile and "Your access" cards; both are still reachable from the sidebar.
> - **Tests:**
>   - integration test `company-portfolio-counts.integration.spec.ts`: every figure, archived contracts excluded, and another company's records never counted;
>   - service unit test;
>   - dashboard and navigation component tests.
> - **Browser:** 26/26 checks in both themes at 1280, 768, 390 and 375 px:
>   - the first-time and populated states;
>   - figures matching the seeded data;
>   - heading order;
>   - no sideways scrolling;
>   - planned items never linking anywhere;
>   - "Create a contract" opening the form.
>
>   One bug found and fixed: on a client-side navigation the form didn't open from the link, because the page rendered before the URL updated.

Add to the overview:

- contracts needing attention (suspended, or nearing the end date);
- incoming invitations (from step 3);
- documents expiring soon (once step 2 records expiry dates).

---

### Verification of steps 2–4 (9 Nov 2026)

| Check | Result |
|---|---|
| API unit tests | 420 passed, 20 skipped (the skips were already there) |
| API integration tests (throwaway PostgreSQL) | 49 passed, 3 skipped (the skips were already there), including the 3 new specs |
| API architecture test, lint (oxlint), build | Passed |
| Migrations | Up, guarded down, down and re-up checked on a throwaway database |
| Web tests | 447 passed, 1 failed: the login-view wording test that was already failing (§4) |
| Web type-check, production build | Passed |
| Web lint | 1 warning, already there (`CompanyAdminShell.tsx`) |
| `next-env.d.ts` | Unchanged |

**Browser checks** ran against a throwaway database, an S3 gateway (VersityGW), and real presigned uploads, in both themes at 1280, 768, 390 and 375 px:

| Area | Result |
|---|---|
| Company documents | All passed |
| Incoming invitations | All passed |
| Contract roles on the Team page | All passed |
| Step 1 Documents tab (regression) | 27/27 |
| Archived-contract documents | **8 failed**, all for the open decision below |

What the passing checks covered:

- **Company documents:**
  - an administrator uploads a document, which is stored under `companies/{company}/documents/`;
  - members read but can't change documents;
  - the contract partner's library stays hidden. Asking for its document returns 404, claiming its company header returns 403, and going through the shared contract returns 404.
- **Incoming invitations:**
  - the card appears, below the page `<h1>`;
  - accepting and declining work after confirmation;
  - the decision is stored.
- **Contract roles on the Team page:**
  - the list excludes archived contracts and the other company's roles;
  - filters work;
  - revoking works.

Two fixes came out of the browser run:

- the invitation card moved below the page heading, to keep the heading order;
- the decline confirmation button became "Decline invitation", so it no longer has the same name as the row's "Decline" button.

### Open decision: documents of archived contracts (rule 4)

Rule 4 says an archived contract's documents "remain accessible according to existing visibility permissions but are read-only". The API now allows that: reads work on archived contracts, and every write returns 409. The integration test proves it by archiving with the roles still in place.

**But the existing archive action doesn't leave roles in place.** `ContractLifecycleService.archive` revokes every contract role on the contract (`revokeAllForContract`), and `restore` doesn't bring them back. Document reads require an active contract role, so after a real archive nobody can read the documents. The browser check confirmed it: the member who uploaded a document gets 403 once the contract is archived.

This widens access, so it hasn't been decided in code. Options:

1. **Roles that the archive revoked still allow reading** that contract's documents, and nothing else. The archive marks them with the same timestamp and actor. This is the smallest change and keeps the current archive behaviour. *(Recommended.)*
2. **Archiving stops revoking roles**, and all workspace modules decide what archived contracts allow. This is broader: it changes the archive behaviour for every module.
3. **Company Administrators of each party company can read** an archived contract's documents, under the same visibility rules. This gives oversight without reviving roles.

## 4. Baseline before starting (run 9 Nov 2026 on this branch)

| Check | Result |
|---|---|
| API unit tests | 405 passed, 20 skipped (the skips were already there) |
| Web tests | **408 passed, 1 failed** |

**The failing test:** `login-view.test.tsx` › "asks to sign in to continue when sent from a protected page" expects "Sign in to continue to that page.". The committed `login-view.tsx` now says "Sign in to continue to your workspace.". The wording was changed without updating the test. Settle on one wording before the next phase, so the next phase starts from a passing suite.

Not run for this inspection: lint, build, integration tests and browser checks.

## 5. Decisions needed before starting

1. **Step 2:** may counterparties on a shared contract see a company's company-level documents, or only that company's own members?
2. **Steps 2–4:** approval for each backend change. These are a migration and two new read endpoints, plus one in-app respond endpoint.
3. **My Contracts:** keep the unlinked `/dashboards/my-contracts` page and the `assignedToMe` filter (for a future "My work" page), or remove them?
4. **Local object storage** for document work: which S3-compatible service should development and browser checks use?

## 6. Out of scope for this role

These are listed so they aren't mistaken for Company Administrator gaps:

- **Workspace-role stories:** milestones, variations, daily logs, inventory, HSE, compliance and finance actions (personas 3–11).
- **Common stories:** two-step verification, sessions, user profile, notification preferences and messaging.
- **Platform administration:** company verification and suspension (persona 1).

## 7. Workspace implementation

### Phase 1: workspace foundation, navigation and access control (10 Nov 2026, uncommitted). No migration.

> **Status: the foundation is implemented and verified. The Project, HSE and Finance operational features are not built yet; see "Next phases".**
>
> **What already existed (reused, not rebuilt):**
> - **Data model:** `contract_workspace` (per contract: `project`, `hse`, `finance`) and `contract_role_assignment`, with `is_workspace_admin` and `revoked_at`. No new entity was needed.
> - **Roles per workspace** (`WORKSPACE_ROLES` in `contract-workspace.ts`). The code's roles differ from the user-story persona names, and the code was followed:
>   - **Project:** Client Project Manager and Client Site Engineer (client party only); Contractor Project Lead and Contractor Site Supervisor (contractor or subcontractor party only).
>   - **HSE:** HSE Officer and HSE Manager (either party).
>   - **Finance:** Finance Officer and Finance Director (either party).
>   - The personas "Client/Contractor HSE Officer" and "Finance Rep" map onto these roles through the party the holder's company belongs to.
> - **Authorization:** `ContractAccessService.authorize(user, company, contract, workspace)` checks active membership, party, a contract that isn't archived, an enabled workspace and an active role in that workspace. Company Administrator rights are not part of the check.
> - **Team management (`ContractRoleAssignmentService`, Roles section):**
>   - Company Administrators, or a Workspace Admin for that workspace, assign and revoke roles.
>   - Only Company Administrators grant or remove Workspace Admin rights.
>   - Revoking the sole Workspace Admin, or removing their rights, gets **409** until a replacement exists (user story 3–5.3).
>   - Only active members of the company can be assigned; others go through the existing role invitation.
> - **Gap found:** the Roles tab was shown only to people who could manage the *Project* workspace. An HSE or Finance Workspace Admin who isn't a Company Administrator had no screen to manage their team. This is fixed by the workspace Team view below.
>
> **API (contract module):**
> - **`GET /api/contract/workspace-access`:** each workspace enabled on the contract, as `{ workspace, hasAccess, roles, isWorkspaceAdmin, canManageTeam }`, built only from the caller's own assignments through their company's party.
>   - Needs an active membership of a party company and a contract that isn't archived: 403 for another company, 404 for a non-party or archived contract.
>   - Returns no IDs or details of anyone else.
> - **`GET /api/contract/workspaces/:workspace`:** the same entry for one workspace, after `ContractAccessService.authorize(…, workspace)`. So a direct URL gets the same **403** (no role there, including Company Administrators) or **404** as any workspace route. An unknown `:workspace` gets 400.
> - **`canManageTeam`:** true when the member holds a role in the workspace and is a Workspace Admin or a Company Administrator, the same rule as the role routes, which check it again on every change.
> - **Structure:**
>   - `ContractWorkspaceAccessService` (no TypeORM), with the existing `ContractAccessService` and role-assignment persistence port. The port gains two scoped reads: `assignments.listActiveForMember` (role and admin flag only) and `workspaces.listEnabled`.
>   - `ContractWorkspaceController`, guarded by `CompanyContextGuard` and `ContractContextGuard`, with `ContractWorkspaceParamDto` (`@IsIn` the three workspaces).
>   - Shared `ContractWorkspaceAccess` and `ContractWorkspaceAccessResponse` types.
>
> **Web:**
> - **Routes:**
>   - `/dashboards/contracts/:contractId/workspaces/:workspace`: the landing screen;
>   - `…/team`: team management.
>   - The contract stays in the URL and in the `X-Contract-Id` header; an unknown workspace is Next's 404.
> - **Entry:** a "Your workspaces" card on the contract Overview links only to the workspaces the member holds a role in, with the role and Workspace Admin status. Without any, it explains why, and points Company Administrators to the Roles section.
> - **Shared layout (`ContractWorkspace`)**, one for all three workspaces:
>   - back to the contract, then the contract reference, title and status;
>   - a "Workspaces" strip with only the workspaces the member can enter;
>   - the workspace's own sections (Overview, plus Team when `canManageTeam`);
>   - the content.
>   - It handles loading, a contract that isn't found, 403 (no access, nothing shown), 404 (no such workspace) and errors with Retry.
> - **Landing screens:**
>   - the workspace's purpose, from the user stories;
>   - "Available now": links to existing contract sections that hold its records, with restricted sections only when the member can use them;
>   - "Coming to this workspace": planned features, each labelled **Planned**;
>   - "Your access": the member's real roles, Workspace Admin, and team management or who manages the team.
>   - No invented figures, records or people.
> - **Team view:** the existing `ContractRoleAssignmentManagement`, now with an optional `fixedWorkspace` that hides its workspace selector. Without team rights the view explains instead, and the API refuses anyway.
> - **RTK Query:** `getContractWorkspaceAccess` and `getContractWorkspace`. Both use the per-workspace role tags that the assign, revoke and admin-rights mutations already invalidate, so access refreshes after role changes.
>
> **Tests (10 Nov 2026):**
> - **API unit:** `contract-workspace-access.service.spec.ts`, 5 tests: fixed order and own roles; a non-member refused before any read; party or archive gives 404; one workspace only through `authorize`; Company Administrator rights never stand in for a role.
> - **API PostgreSQL integration:** `contract-workspace-access.integration.spec.ts`, 23 tests, real HTTP, session guard and context guards.
>   - Access per role; Workspace Admin and team rights; a Company Administrator with no role (no access) and with a role (team rights); a member without assignments; only enabled workspaces listed; revoked roles; the other party's own roles only; a person in two companies scoped to the header.
>   - Wrong company (403), unrelated company and unknown or archived contract (404), and the field list.
>   - Each workspace for its holders; one workspace never opens another; Company Administrators and members without a role refused; revoked or departed members refused; another party's header refused; a workspace the contract lacks; validation (400) and no session (401).
>   - **Team management** with the real service and unit of work: a Workspace Admin assigns only within their workspace and can't grant admin rights; non-admins refused; another company's admin refused (B's admin lists only B's team); the sole admin can't step down until a replacement admin exists; unknown assignment 404.
>   - **Leak checks:** removing the `authorize` call failed 5 tests; treating Company Administrators as having access failed 2. Both were restored.
> - **API totals:** unit 438 passed, 20 skipped; architecture 3/3; `oxlint` clean; compile to a scratch folder clean. Integration 127 passed, 3 skipped (S3), **1 failed**: the activity privacy test, see the note below.
> - **Web:**
>   - `contract-workspace-screens.test.tsx`, 13 tests: routes, the exact API request, contract and workspace naming, only enterable workspaces, real roles, available and planned items, Team only with rights, the fixed-workspace role manager, the Team URL refused, 403, 404, errors with Retry, loading, and the entry card's states.
>   - Type check passes, lint has no errors, and the production build includes both routes.
> - **Browser (42/42, light and dark):**
>   - **HSE Workspace Admin, at 1280, 768, 390 and 375 px:** the entry card offers only HSE; the landing shows the real role and Team; the Team view is the role manager fixed to HSE (1280 and 390 px); Project by URL is refused by the page, and Project and Finance by the API (403).
>   - **Project member:** no Team link, the Team URL refused, HSE refused.
>   - **Company Administrator without a role:** no workspace; the API returns 403 for all three.
>   - **Company Administrator with a Project role:** has Team.
>   - **Finance member at 390 px:** Finance landing; an unknown workspace is a 404.
>   - **The other party:** enters only by its own role (HSE 403); an Acme-only contract shows "Contract was not found".
>   - The screenshots were reviewed. A doubled "Contract was not found" message was fixed and is covered by a test.
>
> **Note, parallel work in the same worktree:** record-level activity targets (`ContractActivityTarget`, `parseActivityTarget` in `contracts-screens.tsx`, and target handling in the Documents, Sites, Signatories and lifecycle components) were added during this phase by another writer. They currently cause:
> - 16 web test failures in `contract-sections.test.tsx` and `contracts-screens.test.tsx`: `useSearchParams()` is null in those tests;
> - 1 API integration failure: the activity privacy test doesn't yet allow the new `target` field.
>
> The workspace work doesn't cause them. They should be resolved with that change. The known `login-view` wording failure also remains.
>
> **Next phases:**
> 1. **Project workspace operations:** stages and milestones (submit, approve, reject, partial), variations, daily site logs and the Project dashboard.
> 2. **HSE workspace operations:** incidents (with protected injury details), inspections and findings, corrective actions and compliance records.
> 3. **Finance workspace operations:** invoices, certification and payments.
> 4. **Cross-workspace communication:** workspace channels between the parties, direct messages and comments.
>
> The read-only domain APIs (delivery, HSE, financial, compliance, site operations) already exist. Each phase adds their write paths and the workspace screens.

### Company invitations separated from contract roles; client and contractor role sets (11 Nov 2026, uncommitted). One migration.

> - **Company roles are membership only:** `ECompanyRole` is now `Company Administrator` or `Member`; `EInvitationRole` is gone. A team invitation carries an email, optional first and last name and a company role. Accepting it creates or reactivates the membership only. It creates no contract role, contract-role invitation or workspace access. Contract and workspace fields sent with an invitation are stripped by the global whitelist. A returning member keeps their job title.
> - **Contract roles by side:**
>   - `EClientContractRole` (Client Project Manager, Client Site Engineer, HSE and Finance roles) and `EContractorContractRole` (Contractor Project Lead, Contractor Site Supervisor, HSE and Finance roles).
>   - The stored values are unchanged, and HSE and Finance share theirs. The side comes from the contract party: CLIENT uses client roles; CONTRACTOR, SUBCONTRACTOR, VENDOR and OTHER use contractor roles.
>   - The API checks the side on assignment, invitation and acceptance. Unknown roles return 400 before any transaction.
>   - `GET …/role-management` now also returns `roleSide` and the workspace's `roles` for that side. The role manager offers only those roles.
> - **Migration `CompanyMembershipRoles1793600000000`:**
>   - Up: both company-role enums become (`Company Administrator`, `Member`). Administrators stay administrators; every other member and invitation becomes `Member`. The old labels are copied first to `migration_company_role_backup`.
>   - Down: restores the exact earlier labels, keeps anyone promoted to administrator since, and drops the backup table. It refuses, changing nothing, while a Member or invitation has no earlier label, or an invitation is for an administrator.
>   - Contract-role enums are untouched. The recovery planner's identity probe accepts both label sets.
> - **Verification:**
>   - **API:** unit 477 passed. The migration up/down was tested on a disposable PostgreSQL 17 (5/5), including both refusals and re-apply. Integration 130 passed, plus 3 new company-invitation tests on PostgreSQL. Architecture 3/3; lint clean; scratch compile clean.
>   - **Web:** the invitation form and side-filtered role manager are tested. Type check, lint and production build pass.
>   - **Known failures:** the 17 web failures and 1 API integration failure listed above remain. The recovery-planner Scenario 2 fails because its reviewed manifest lists 11 migrations, while 16 were already registered before this change.

## 8. Individual contract visibility with Company Administrator oversight (11 Nov 2026, uncommitted). No migration, no backfill.

> **Approved policy:**
> - **Ordinary members** see a contract only with an active (unrevoked) `CONTRACT_ROLE_ASSIGNMENT` held through their own `COMPANY_USER` on their company's `CONTRACT_PARTY` row, while their membership is active (`status = active`, `left_at IS NULL`) and the contract isn't archived.
> - **Company Administrators** keep explicit read-only oversight of every contract their company is party to, with or without a role.
> - **Not enough on their own:** company membership, a company invitation, a role on another contract, and a role held through another company's party.
> - **No backfill:** no assignment, invitation or event was created, and no existing assignment was changed.
>
> **Superseded:** this replaces two statements in §7 Phase 1:
> - "Works for members with no role at all";
> - the 403s for a member without a role.
>
> Such a member now gets 404, because the contract is not visible to them.
>
> **Source of truth:** the existing `CONTRACT_ROLE_ASSIGNMENT`. It can represent everything the policy needs. The composite foreign keys tie each assignment to the same company as its party and member, so no new entity or migration was needed. Every contract role maps to a workspace, so a role is never "visibility only". Administrator oversight is a separate, explicitly named path, not a role.
>
> **Authorization model (API):**
> - **`ContractRepository` scope** is now `IContractVisibilityScope { companyId, companyUserId, includeCompanyAdminOversight }`.
>   - Every read applies one correlated `EXISTS` over `contract_party`, joined to the reader's active `company_user` row.
>   - That `EXISTS` requires an active assignment on that party. When oversight is allowed, it alternatively requires the stored `company_role = 'Company Administrator'`.
>   - The rule runs in SQL before paging and counting, so search, sort, filters, totals, the parent-contract picker (same endpoint) and `assignedToMe` all follow it. Several roles never duplicate a row.
> - **`ContractAccessService.authorizeContractOversight`** is the named visibility check (assignment or admin oversight). It returns an internal `basis` (`assignment` or `company_admin_oversight`), which is never serialized.
>   - `ContractService` uses it for `GET contract`, `/parties`, `/status-history` and `/workspaces`.
>   - The old party-only `requireMembership` is gone.
> - **`ContractAccessService.authorize` / `authorizeIncludingArchived`** are unchanged in what they grant: always an active role for the requested workspace (`general` means any role).
>   - They now answer **404** when the reader can't see the contract: an ordinary member with no role on this party, a revoked role, or a role elsewhere.
>   - They answer **403** when the contract is visible but the workspace or resource isn't: an administrator without a role, or a role in another workspace.
>   - Oversight is consulted only to tell 404 from 403. It never grants.
> - **Same rule elsewhere:**
>   - `GET contract/workspace-access`: 404 for a member without a role; an administrator without a role gets every `hasAccess: false`.
>   - `GET contract/lifecycle-permissions` and `GET contract/role-management`: 404 for a member without a role. The lifecycle port gains `hasAnyActiveAssignment`.
> - **Unchanged administrator management** (stories 6–8 and 10–18): lifecycle edits, archive and restore, sites, signatory, party invitations, role assignment and invitation, and `company/role-assignments` keep their existing Company Administrator or Workspace Admin checks. These are management permissions, separate from visibility.
> - **`GET company/dashboard`** is already Company-Administrator-only, so its company-wide counts are a company-level administrative metric consistent with oversight.
>
> **What a Company Administrator without a role gets:**
>
> | Endpoint | Result |
> |---|---|
> | `GET contracts`, `GET contract`, `/parties`, `/status-history`, `/workspaces` | ✅ Allowed (oversight) |
> | `GET contract/workspace-access` | ✅ 200, every workspace `hasAccess: false`, `canManageTeam: false` |
> | Lifecycle, sites, signatory, party invitations, role management (existing admin checks) | ✅ Allowed as before |
> | `contract/workspaces/:workspace`, activity and actors, documents, stages, milestones, variations, invoices, payments, HSE incidents, inspections and corrective actions, sites, daily logs, inventory (collections and single records) | ❌ **403** |
>
> **Status codes:**
> - 401: no session.
> - 403: company context refused (not an active member: departed, inactive or wrong `X-Company-Id`). These are decided by `CompanyContextGuard` before any contract check, so a departed member gets 403 rather than 404, as before (decision recorded in §9).
> - 404: contract not visible or not a party. A made-up contract ID gets the same body.
> - 403: contract visible, workspace or resource not.
> - 409 and 400: unchanged.
>
> **Web:**
> - **RTK Query:**
>   - Assigning or revoking a role also invalidates the contract list and detail.
>   - Accepting a contract-role invitation, or a company invitation, invalidates the list.
>   - Changing Workspace Admin rights refreshes the list's role badges.
>   - Changing a company role refreshes every contract view.
>   - Removing a member refreshes role views.
>   - Contract queries are keyed by company and read `currentData`, so switching company never shows another company's list. Sign-out resets the cache.
> - **Copy:**
>   - The contract list describes its reader: "Contracts your company is a party to." for administrators, "Contracts you hold a role on." with a matching empty state for members.
>   - A contract that isn't visible shows "Contract was not found. It may have been archived, or you don't have access to it." on both the detail page and the workspace pages, without Retry, and never names the contract.
>   - "Your workspaces" tells an administrator without a role that oversight covers details, parties and history, and that workspaces, activity and documents need a role.
> - The API remains the boundary; nothing is filtered only in the browser.
>
> **Legacy access, no backfill:**
> - **Report:** `docs/contract-visibility-impact-assessment.sql` is read-only (`BEGIN TRANSACTION READ ONLY … ROLLBACK`). For each non-archived contract and each active member of an active party company, it lists:
>   - the contract ID, reference and title;
>   - the company ID and name, and the party type;
>   - the company user, user ID, email and name;
>   - the company role, whether they're an administrator, and whether they hold an active assignment;
>   - the outcome: `KEEPS: individual role`, `KEEPS: admin read-only oversight`, or `LOSES: no role on this contract`.
>
>   A per-company summary follows. It was checked on a seeded scratch database and matched the seed exactly.
> - **Operational steps before deploying:**
>   1. Run it as an authorized operator against production. The output holds personal data.
>   2. Review the `LOSES` rows with each company's administrators.
>   3. Have them give a role to the people who should keep a contract, through Contract › Roles (or a role invitation), which records who assigned it.
>   4. Re-run the report until the remaining `LOSES` rows are intended.
>
>   There is no endpoint for this report.
>
> **Tests (11 Nov 2026):**
> - **API unit:** 489 passed, 25 skipped. New and updated cases:
>   - `contract-access.service.spec.ts`: oversight basis; 404 versus 403; an administrator refused on general, project, HSE and finance; the visibility scope passed to SQL.
>   - `contract.service.spec.ts`: every detail read goes through oversight.
>   - `contract.repository.spec.ts`: both SQL branches, member and status checks, and a blank member refused.
>   - `contract-lifecycle.service.spec.ts`: 404 for a member without a role; an administrator still allowed.
> - **API PostgreSQL integration:** 155 passed, 3 skipped (S3), 1 failed (the known activity-privacy `target` test, §7 note).
>   - **New `contract-visibility.integration.spec.ts`** has 24 tests over real HTTP, with the real contract, workspace, activity, delivery, financial, HSE and site-operations controllers. It covers:
>     - discovery for administrators and members;
>     - search, sort and status filters revealing nothing;
>     - revocation, keeping one of several roles, and duplicates counted once;
>     - a role via another company's party, for a person in two companies;
>     - unrelated, departed and inactive members;
>     - the oversight surface, 404s and an identical body for a made-up ID, and archived contracts;
>     - 403 on 29 protected routes for an administrator and 404 for a member;
>     - workspace-specific roles and Workspace Admin limits;
>     - administrator management still working;
>     - a direct assignment granting visibility and its revocation removing it.
>   - **Leak check:** restoring the party-only SQL failed 7 of these tests. It was then restored.
>   - **Updated to the new rule:** pagination, assigned-to-me, company invitations (an accepted Member invitation sees nothing; an Admin invitation gets oversight and 403s), activity access, and workspace access.
> - **API checks:** architecture 3/3, `oxlint` clean, build clean. The shared `contracts-schema` builds and was not changed.
> - **Web:** 510 passed. Type check clean, lint 0 errors (one existing warning in `CompanyAdminShell.tsx`), production build passes. New tests:
>   - `contractVisibilityCache.test.ts`: refetch after assign, revoke, invitation acceptance and company-role change; companies kept separate.
>   - The oversight copy on the workspaces card, not-found without Retry, and list copy per reader.
> - **Known failures at the time:** the 17 web failures (16 `useSearchParams` from the activity-target work and the `login-view` wording) and 1 API integration failure listed in §7. **All resolved in §9.**
> - **Browser (47/47):** headless Chrome against a scratch API and PostgreSQL, light and dark, at 1280, 768 and 390 px:
>   - **Administrator without a role:** the list shows both contracts; the overview shows the oversight note and no workspace links; parties work; History explains that activity is for the contract team; Documents explains the same; a Finance workspace URL is refused.
>   - **Member without a role:** an empty list with the member copy; a direct contract URL and a workspace URL both show not-found without the title or reference.
>   - **Project Lead:** sees only their contract, with the Project workspace link.
>   - **Finance member:** refused from Project.
>   - No horizontal overflow, and the theme was applied in every run. Screenshots were reviewed.
>
> **Open product follow-ups:**
> - Whether administrators should see archived contracts' parties and history under oversight. Today archived contracts are listed only for restore, as before.
> - Whether to remove or link the unlinked My Contracts page. For members it now matches the main list.

## 9. Stabilization, authorization regression and deployment readiness (11 Nov 2026, uncommitted). No migration, no backfill.

> **Status: regression suite green; authorization verified over HTTP and in the browser. Deployment is not done and needs the operator steps and one product decision below.**
>
> **Regression fixes:**
> - **16 web tests** (`contract-sections.test.tsx`, `contracts-screens.test.tsx`) had no `next/navigation` mock, so `useSearchParams()` was null.
>   - Both now use the suite's existing convention: a hoisted `URLSearchParams` returned by `useSearchParams`, reset before each test.
>   - Four new tests cover deep links: no query; a valid target with version and workspace reaching the section component; unknown types, sections, missing IDs and unknown workspaces ignored; the target following a changed URL.
>   - A test-only defect from §8 was also fixed: `CONTRACT_UNAVAILABLE_TEXT` now lives in `contract-sections.ts`, a plain module, instead of a component module these tests mock.
> - **Login wording:** the notice appears only when `?redirect=` is present, and sign-in returns the user to that exact page. That page is often an invitation page, not a workspace. The test's "Sign in to continue to that page." was right; the component's "…to your workspace." was corrected. No behaviour changed.
> - **Activity privacy (API integration):**
>   - The field-list check now includes `target` and requires it to be `null` for rows without an approved record ID.
>   - A new test checks exact target shapes for sites, roles (with workspace) and documents (with version). It also checks that an unknown workspace is dropped; that deleted documents, mismatched entity types and non-string IDs give no target; that the other company's targets never appear; and that no metadata, storage keys, member IDs, secrets, IPs or user agents leak.
> - **Root-cause bug found by that test:** `ActivityService.activityTarget` read `changes.after` through a string-only helper. Every change-set target was therefore always `null`: site created/updated, signatory recorded, and the four party-invitation actions. Their "Open …" links could never appear.
>   - Fixed with a `recordObject` helper; only the named ID is taken.
>   - A unit test covers it, and it was verified end to end: a site created through the real API produces an "Open Sites" link that lands on the highlighted row.
>
> **Contract-existence oracles closed (management endpoints):**
> - Some management paths answered 403, or a 404 with a different message, before deciding whether the caller could see the contract. Examples: the global contract lookup in `GET/PATCH contract/parties/signatory`, and the contract and workspace lookups in role management.
> - A member without a role, or a member of a non-party company, could therefore confirm that a contract ID exists and learn some of its setup.
> - Now every contract-scoped management path decides visibility first:
>   - `ContractLifecycleService.requireContractCompanyAdmin` and `canSeeContract` cover sites, signatory, party invitations, edits, workspaces, archive, restore and transitions.
>   - `ContractRoleAssignmentService.assertVisible` and `assertVisibleTo` cover role-management reads, assign, revoke, Workspace Admin rights and role invitations.
> - A caller who can't see the contract gets the same 404 body as for a made-up ID. Administrators and visible members keep their exact previous answers (403 for missing rights, 409 for conflicts).
> - No new port, entity or migration was needed.
>
> **Departed and inactive members (decision recorded, behaviour unchanged):**
> - `CompanyContextGuard` refuses them with 403 before any contract is read. The answer is therefore identical for every contract ID, real or made up, and cannot reveal a contract's existence. HTTP tests prove this across every contract route.
> - Turning it into 404 would mean either the guard special-casing contract routes, or answering departed members differently from people who were never members. Both would change the documented 403 for "wrong company header" on the same routes.
> - **Decision:** keep 403 at the company boundary. If product still wants 404 on contract routes, the smallest change is for `CompanyContextGuard` to answer 404 when `X-Contract-Id` is present. It would apply to all callers without an active membership, and the activity, workspace and document specs that expect 403 would need updating.
>
> **Archived contracts under oversight (requires an explicit product decision; nothing changed):**
>
> | Aspect | Finding |
> |---|---|
> | Current behaviour | Archiving sets `deleted_at` and **revokes every contract role and pending role invitation**; restore doesn't bring them back. An archived contract appears only in the creating company's administrator restore list (`includeDeleted`). Detail, parties and status history return 404 for everyone, administrators included. Status history is append-only and returns on restore. |
> | User stories | Story 7 calls archiving "delete"; story 8 is "recover a deleted contract's full information via a single button"; story 9 is "read-only navigation through every past and current contract". No story says to browse a deleted contract without restoring it. "Past" reads most naturally as completed, terminated or expired contracts, which stay visible under oversight. |
> | Architecture | Oversight already supports archived reads (`authorizeContractOversight(…, { includeArchived })` and `findByIdIncludingArchived`), so read-only archived detail would be a small change. Party admins of other companies can't restore. |
>
> Options:
> 1. **Keep current behaviour** (recommended): deleted means out of view until the creator's administrator restores it in one click.
>    - Least exposure: a counterparty never sees a contract its owner deleted.
>    - Matches stories 7–8.
> 2. **Creating company's administrator only** can read an archived contract's detail, parties and history.
>    - Low risk and useful before restoring.
>    - Needs approval and HTTP tests.
> 3. **Every party company's administrator** can read archived contracts.
>    - Widest: exposes another company's deletion decision and its pre-deletion data.
>    - Not recommended.
>
> **Operational note:** because archiving revokes roles and restore doesn't re-grant them, after a restore only administrators (by oversight) see the contract until roles are assigned again. This predates this work and should be stated in the archive confirmation, or decided separately.
>
> **Legacy impact assessment, validated (read-only):**
> - `docs/contract-visibility-impact-assessment.sql` has no data-changing statement. It runs in `BEGIN TRANSACTION READ ONLY … ROLLBACK`; the check confirmed the rollback.
> - On a scratch database seeded with edge cases, every detail row matched the policy:
>   - a person in two companies is judged separately per company;
>   - several roles on one contract (one revoked) give one row;
>   - a revoked-only role is `LOSES`;
>   - departed and inactive members, an archived contract and an inactive company are excluded.
>
>   Each summary row equalled the aggregation of the detail rows.
> - The administrator label `'Company Administrator'` is the same before and after the pending migration `CompanyMembershipRoles1793600000000`, so the report gives the same answer whichever runs first.
> - Caveat: suspended user accounts are listed like active ones, because the report follows memberships. Operators can ignore suspended users.
>
> **Verification (actual runs, 11 Nov 2026):**
>
> | Check | Result |
> |---|---|
> | API unit | 490 passed, 25 skipped. The skips are the two disposable-PostgreSQL migration specs, gated by environment. |
> | API disposable-PostgreSQL specs, run on a scratch server with the safety variables | 33 passed, **1 failed**: recovery-planner Scenario 2 expects 11 migrations in its reviewed manifest while 17 are registered. Pre-existing (§7), not related to visibility, not part of the deploy path. |
> | API PostgreSQL integration | 168 passed, 3 skipped (live S3 bucket not configured), 0 failed |
> | `contract-visibility.integration.spec.ts` | 35 passed (24 earlier + 11 new: indistinguishable answers for no role, revoked role, non-party members and admins, departed and inactive members, another company's header, across 48 probes per user; administrator with a role; multiple roles; invalid workspace 400; admin-only 403s; `company/role-assignments`; 409 conflicts) |
> | Leak checks | Disabling the new visibility-first checks failed 3 probe tests; restored afterwards |
> | API architecture / `oxlint` / build | 3/3, clean, clean |
> | `contracts-schema` build | Passes; not changed by this work |
> | Web tests | **531 passed, 0 failed** |
> | Web type check / lint / production build | Clean / 0 errors (1 existing warning in `CompanyAdminShell.tsx`) / passes |
> | Browser (headless Chrome against a scratch API and PostgreSQL) | **63/63** checks in light and dark at 1280, 768 and 390 px. Covers: administrator oversight and refusals; member empty list and not-found pages; Project Lead; Finance refused from Project; HSE Workspace Admin (HSE only, Team view, Finance refused); an administrator with a role following a real activity entry's "Open Sites" link to the highlighted row, query kept. Screenshots reviewed. |
>
> `company/dashboard` stays Company-Administrator-only. Its unit test covers it; it wasn't mounted in the HTTP spec.
>
> **Deployment readiness:**
>
> | # | Item | Status |
> |---|---|---|
> | 1 | Production environment configuration: no new variables or headers for this policy | Ready |
> | 2 | Schema: the visibility change needs no migration. Render's API `startCommand` runs `migration:run` automatically, which will also apply the pending, uncommitted `CompanyMembershipRoles1793600000000` (company roles become Administrator or Member). Its up/down passed on a scratch server. | Ready for review; the operator must expect that migration on first start |
> | 3 | Impact assessment run against production by an authorized operator, before deploy | **Requires production operator action** |
> | 4 | Review `LOSES` rows with each company's administrators | **Requires production operator action** |
> | 5 | Deliberate role assignments through Contract › Roles or role invitations. No backfill. | **Requires production operator action** |
> | 6 | Production smoke tests after deploy, per company: an administrator lists contracts and opens detail, parties and history (200) and is refused a workspace (403); a member with a role sees only their contracts and workspace; a member without a role sees an empty list and 404 on a direct URL | **Requires production operator action** |
> | 7 | Error handling and logging: unchanged; 401, 403, 404 and 409 follow §8 and this section | Ready |
> | 8 | Rollback: a code rollback restores company-wide visibility at once (no schema change for visibility). Rolling back the company-role migration has its own guarded `down` (§7). | Ready |
> | 9 | No access-granting migration: verified that no migration inserts `contract_role_assignment` rows, and the report has no writes | Ready |
> | 10 | Archived-contract oversight policy | **Requires explicit product decision** (recommendation: keep current) |
> | 11 | The work is uncommitted on `company-admin-phase3`, together with other in-progress changes | **Blocked until committed and reviewed** |
>
> **Verdict:** ready for deployment review once item 11 is done and item 10 is decided, or explicitly deferred with the current behaviour. Items 3–6 must be completed by an authorized operator around the deploy.
