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
| 9 | Read-only navigation through every past and current contract | `GET contracts`, `GET contract`, parties, status history | Contract list and detail tabs | ✅ Done (workspace data is correctly withheld; see the constraint below) |
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

Show `GET contract/activity` alongside status history, with filters by date, user and action. This also covers the Client Project Manager's "audit trail" story.

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
