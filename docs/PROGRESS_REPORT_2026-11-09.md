# ContractFlow — progress report, Monday 9 November 2026 (07:00 to 16:30)

## Summary

Today the remaining Phase 3 work was wrapped up and merged, and the Company Administrator area moved forward on four fronts:

1. **Documents.**
   - A Documents tab on every contract.
   - A private company-wide document library.
   - Clear rules on who can see what, enforced by the API.
2. **Invitations to contracts** can now be answered inside the app, not only from the email link.
3. **Contract roles across the company** can be reviewed and revoked from the Team page.
4. **The Company Overview** was rebuilt to the "first-time owner's dashboard" mockup:
   - every figure comes from real data;
   - the cards switch to the other theme on hover.

Two documents and one design deliverable were also produced: a UI guide, a desktop prototype PDF covering every planned screen, and a Company Administrator roadmap.

All backend and database changes were approved before they were built. **Everything after PR #70 is uncommitted** on branch `company-admin-phase2`: 56 changed files and 24 new ones. It has been tested and browser-checked, and still needs a commit and a pull request.

---

## Timeline

Times come from git history and file timestamps. Morning times are approximate.

| Time | Work |
|---|---|
| Morning | Phase 3 finishing touches: "My contracts" removed from the sidebar, members land on Contracts after sign-in, password-reset migration fixed on the dev database |
| 10:50 | Phase 3 committed (`4da40ca`, 138 files). Merged as **PR #70** at 11:07 |
| ~11:00 | **UI guide** written (`docs/UI_GUIDE.md`) |
| ~11:35 | **Desktop prototype PDF**, 72 screens (`docs/ContractFlow_Desktop_Prototype.pdf`) |
| ~12:00 | Company Administrator inspection and **roadmap** (`docs/COMPANY_ADMIN_NEXT_IMPLEMENTATION.md`) |
| 12:10–12:30 | **Step 1:** Documents tab on contracts |
| 12:50–14:25 | **Steps 2–4:** company documents, incoming invitations, company-wide contract roles |
| ~15:00 | Dev environment: migrations applied, local file storage set up |
| 15:30–16:00 | **Company Overview** rebuilt to the mockup, with the dashboard API extended |
| 16:00–16:30 | Overview cards: hover theme switch; "Create a contract" card made uniform |

---

## 1. Morning: Phase 3 wrap-up (merged in PR #70)

- **Sidebar:** the "My contracts" link was removed from every sidebar. The page and its API filter remain in the code, but nothing links to them.
- **After sign-in:** Company Administrators land on Overview. Members, who can't open Overview, land on Contracts.
- **Dev database fix:** `QueryFailedError: relation "password_reset_token" does not exist`. The database was missing two migrations (document storage and password reset), and both were applied.
- **PR #70:** you committed Phase 3 (`4da40ca`) and merged it (`d2a7b46`). It included Phase 2, Phase 3 items 1–7, password reset and the 6–9 November progress report.

## 2. Documentation and design

- **UI guide** (`docs/UI_GUIDE.md`): how to build screens consistently. Covers:
  - design tokens, type scale, control sizes and theme;
  - the app shell and page structure;
  - which component to use for each need;
  - form rules: labels, validation, focus, and typing money and percentages naturally;
  - data display: formatting, status badges, and list states;
  - accessibility, wording, and the scope rules as they affect the UI;
  - testing, and a pull request checklist.
- **Desktop prototype** (`docs/ContractFlow_Desktop_Prototype.pdf`, 82 pages):
  - 72 screens covering all 11 user-story personas, built with the app's own colour and type settings;
  - an oil and gas look, with fictional sample data;
  - 20 screens marked "Built" (already in the app); the rest are proposals.
- **Company Administrator roadmap** (`docs/COMPANY_ADMIN_NEXT_IMPLEMENTATION.md`):
  - checked the 18 Company Administrator stories against the code: 12 were complete, and documents, invitations and company-wide roles were missing;
  - set out a step-by-step plan, kept up to date through the day.

## 3. Step 1: contract Documents tab (frontend only)

- A **Documents** section on every contract:
  - upload, using the browser's SHA-256 checksum and a direct upload to storage, with a progress bar;
  - new versions with version history, and download of any version;
  - delete, with confirmation;
  - a clear message for people without a role on the contract.
- **Bug fixed:** an open version panel reloaded a deleted document (a 404).
- **Browser check:** 27/27, in both themes at four screen widths, against a throwaway S3 store.

## 4. Steps 2–4: approved API and database work

### Product rules (as decided)

1. **Company-wide documents:** only members of the owning company.
2. **"All parties" contract documents:** role holders of every company on the contract.
3. **"Your company only" contract documents:** the uploading company only.
4. **Archived contracts:** documents readable, but read-only.

### Step 2: company documents

- **Database:** `document.contract_id` may now be empty, meaning a company-wide document. A database rule makes those always private, and there's a new index.
- **API:** `company/documents` routes for list, view, upload, new version, download and delete.
  - Any member can read.
  - Only Company Administrators can change.
  - Another company's document is "not found".
- **Web:** a **Company documents** page in every member's sidebar, reusing the Documents tab.
- **Archived contracts:** documents can be read, and every change is refused (409). See the open decision in §9.

### Step 3: answering contract invitations in the app

- **API:**
  - list pending invitations to your company;
  - accept or reject one by ID, with the same checks as the email link, through the same code.
- **Web:** an "Invitations to contracts" card on the Overview. Accepting and declining each ask for confirmation.

### Step 4: contract roles across the company

- **API:** `company/role-assignments`, for Company Administrators, filterable by member and workspace. A new index supports it.
- **Web:** a **Contract roles** section on the Team page, with filters, links to each contract, and revoke with confirmation.

### Fixes found during browser checks

- The invitation card sat above the page's main heading; it was moved below.
- Two buttons were both labelled "Decline"; the confirmation now says "Decline invitation".

## 5. Development environment

- **Dev database:** four migrations applied as they became due (document storage, password reset, company documents, role-assignment index).
- **Local file storage:** uploads failed with `CredentialsProviderError`, because the dev `.env` pointed at the real AWS bucket with no credentials. As you chose, dev uploads now go to the local storage container:
  - `infra-object-storage-1`, port 9000, bucket `contractflow-local`;
  - `apps/api/.env` updated, with the AWS bucket name kept in a comment.

  The MinIO image in the compose file can no longer be downloaded (401 from quay.io).

## 6. Company Overview rebuilt to the mockup

- **API (approved):** the dashboard now also returns real counts, limited to your own contracts that aren't archived:
  - stalled contracts (no change in 14 days);
  - non-compliant contractors;
  - overdue payments;
  - one figure per department workspace.

  No migration was needed. Figures read 0 until the HSE, finance and compliance modules record data.
- **Page:**
  - a time-of-day greeting;
  - welcome text for first-time owners;
  - Portfolio health and Department workspaces;
  - Quick actions ("Create a contract" opens the form directly);
  - Recent activity, with a "No contracts yet" empty state;
  - Contracts ending soon.
- **Sidebar:** grouped as in the mockup. Tasks, Calendar, Reports, the four department workspaces and Help & Support show as disabled "Planned" items, as you chose.
- **Hover:** all 11 cards switch to the other theme on hover, and the "Create a contract" card now matches the others. Text measured on the hovered cards stays at 4.97:1 or better.
- **Bug fixed:** "Create a contract" didn't open the form after an in-app page change.

## 7. Backend and database changes today

| Change | Type | Status |
|---|---|---|
| Company-wide documents (`1793500000000`) | Migration: nullable column, CHECK rule, index | Uncommitted. Applied to the dev database |
| Company role-assignment index (`1793500000001`) | Migration: index only | Uncommitted. Applied to the dev database |
| `company/documents` | 7 new endpoints | Uncommitted |
| `company/contract-invitations` | 2 new endpoints | Uncommitted |
| `company/role-assignments` | 1 new endpoint | Uncommitted |
| `company/dashboard` | New read-only fields | Uncommitted |
| Archived-contract document access | Read allowed, writes refused | Uncommitted |

**Deploy note:** run `migration:run` before releasing these features to any environment. Both new migrations were checked going up, rolling back and re-applying. The documents migration refuses to roll back while company-wide documents exist, so it never deletes data silently.

## 8. Quality checks (latest runs today)

| Check | Result |
|---|---|
| API unit tests | 421 passed, 20 skipped (skips were already there) |
| API integration tests (throwaway PostgreSQL) | 51 passed, 3 skipped (skips were already there). 6 new specs |
| API lint, architecture test, build | Passed |
| Web tests | 455 passed, 1 failed: the login wording test, already failing before today's work |
| Web type-check, production build | Passed |
| Web lint | 1 warning, already there (`CompanyAdminShell.tsx`) |

The new integration tests cover:
- cross-company document access and refused actions;
- incoming invitations;
- company-wide roles;
- the Overview's figures, including that one company's records never appear in another's counts.

The latest full web run was before the final two hover tweaks. The Overview's own tests (13) were re-run after them and pass.

**Browser checks** (throwaway database and storage, both themes, 1280/768/390/375 px):

| Area | Result |
|---|---|
| Documents tab | 27/27 |
| Steps 2–4 | All passed except the 8 archived-contract checks (open decision below) |
| Company Overview | 26/26 |
| Hover contrast | 11/11 cards in both themes |

The final change, making "Create a contract" match the other cards, wasn't re-checked in the browser. It uses the same styling as a card that was.

## 9. Open decisions and follow-ups

1. **Archived-contract documents (rule 4).**
   - Archiving revokes every contract role, so in practice nobody can read an archived contract's documents. The API is ready to allow reads once you choose an option:
     - roles removed by the archive still allow reading (recommended);
     - archiving stops revoking roles;
     - Company Administrators of each party can read.
2. **Failing login test:** decide on the wording ("…to that page" or "…to your workspace").
3. **Company-document audit:** these events go to the server log, because the activity log requires a contract.
4. **The compose file's MinIO service:** its image can no longer be downloaded, so it needs replacing.
5. **"My Contracts" page:** keep it for later, or remove it?
6. **Commit and review:** today's work needs a commit and a pull request.

## 10. Not part of this work

These changed in the working tree during the day, but not as part of this work (another session or your own edits): the company website helper (`apps/web/src/lib/website.ts` and its test), the company create and update request DTOs and their spec, `onboarding-view.tsx`, `company-profile-view.tsx` and `.vscode/settings.json`. Review them separately before committing.
