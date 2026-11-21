# Audit log

How ContractFlow records who did what, and how to add auditing to a new operation.

## The records and what each one is for

| Record | Holds | Written by |
|---|---|---|
| `activity_log` | Significant actions on a contract, by any module: one row per action, with the actor, the affected record and what changed. | Contract lifecycle, sites, signatories, party invitations, role assignments and invitations, documents. |
| `company_audit_log` | Company-level actions that concern no contract, such as company invitations. | Company administration (`company-admin.service.ts`). |
| `contract_status_history` | Every contract status transition. A domain history, not an audit log. | Contract lifecycle. |
| Future domain histories, such as milestone submissions and decisions | The lifecycle of one kind of record. | Their module. |

Keep these separate. A domain history is the source of truth for its record's lifecycle; the audit log says who acted and when. An operation that needs both writes both, in the same transaction.

## Recording an entry

1. **In the same transaction as the change.** Write the entry through the module's Unit of Work context (for example `context.activity.record(...)`), inside the `unitOfWork.execute` callback that makes the change. If the change fails, the entry is rolled back with it, so the log never shows an action that didn't happen.
2. **Through `buildActivityEntry`** (`apps/api/src/common/application/activity-entry.ts`). The context factory, which is infrastructure, passes the service's input through it before saving. It validates and normalizes the entry and refuses anything it can't write safely.
3. **With server-side context only.** `companyId`, `contractId` and `actorUserId` (the acting `company_user.id`) come from the authorized scope and the resolved membership, never from a request body or query.

The fields:

| Field | Rule |
|---|---|
| `action` | `area.verb_noun`, such as `contract.site_created` or `milestone.approved`. Add it to `CONTRACT_ACTIVITY_ACTIONS` in `packages/contracts-schema`; a unit test keeps that list in step with the services. |
| `entityType`, `entityId` | The affected record's kind (`snake_case`) and its own id (a ULID). |
| `summary` | One sentence for people reading the log. Longer text is cut at 500 characters. |
| `changes` | `{ before, after }` with only the fields that changed, not whole records. |
| `metadata` | References that aren't changes, such as a related record's id. |
| `workspace` | `project`, `hse` or `finance` when the entry concerns that workspace's content (a milestone, an incident, an invoice). Leave it empty for contract-wide actions. |
| `reason` | The explanation the user gave, where one is required (a rejection, a hold). At most 2,000 characters. |
| `occurredAt` | When it happened. Stored as a UTC instant. |

`changes` and `metadata` together are limited to 16,000 characters.

### Never record

`buildActivityEntry` refuses these keys at any depth, ignoring case, `_` and `-`:

- credentials: `password`, `passwordHash`, `token`, `tokenHash`, `accessToken`, `refreshToken`, `sessionToken`, `secret`, `apiKey`, `authorization`, `cookie`;
- the encrypted HSE injury description: `injuryDescription`.

Also leave out document contents, storage keys, and anything a reader of the contract shouldn't see. Prefer ids and status values over free text copied from the record.

## Integrity

- The application can only add entries: `ActivityLogRepository.update` and `delete` throw, and no endpoint changes or removes them.
- A refused entry throws `InvalidActivityEntryError`, which fails the whole operation. This is a defect in the calling code, so it surfaces as a server error, not a validation message.
- The database itself doesn't prevent `UPDATE` or `DELETE` by a privileged connection. If that is needed, the options are a trigger that rejects both, a database role without those privileges for the application, or hash-chaining entries. None is in place yet.

## Reading the log

`GET /api/contract/activity`, with `X-Company-Id` and `X-Contract-Id` headers.

- **Who can read it:** a member of the header company holding an active role on the contract (`ContractAccessService.authorizeWithWorkspaces`). A Company Administrator without a role is refused (403), and a member who can't see the contract gets 404.
- **Whose entries:** only the header company's own. Another party's entries on a shared contract are never returned.
- **Workspace entries:** shown only to readers holding a role in that workspace. Contract-wide entries are visible to every reader. A `workspace` filter can't widen this.
- **Filters:** `fromDate`, `toDate`, `actorUserId`, `action`, `entityType`, `entityId`, `workspace`, plus `page` and `limit` (at most 100). Newest first.
- **Response:** each entry's action, record, workspace, reason, summary, actor name and a link target. Change sets, metadata, request details and IP addresses stay internal.

`GET /api/contract/activity/actors` lists the actors of the entries the reader may see.

## Older entries

Before migration `ActivityLogAuditFields1793700000000`, `entity_id` was a `uuid` column and writers stored a random UUID there; the real record id is in `changes.after` or `metadata`. Those entries keep their UUIDs, so a record filter (`entityId`) finds only entries written since the migration. The feed's links read the ids from `changes` and `metadata`, so they work for old and new entries.

## Not yet audited

These operations exist but write no audit entry. Each should adopt the pattern above when it is next changed:

- **Identity and security:** sign-in, sign-out, password change and reset, email verification, account profile changes. These are user-level and concern no contract or company, so they need a user-scoped log, or `company_audit_log` if company-scoped.
- **Company administration:** member role changes and removals, company profile changes, company document actions that concern no contract.
- **Contract:** contract creation and detail edits (`PATCH contract`).
- **Workspace modules:** Stages and Milestones, Variations, Daily logs, Inventory, HSE, Compliance, Invoices and Payments. They are read-only in the API today; each write operation should record entries with its `workspace` set when it is built.

## Planned: Stages and Milestones

The API can only read stages and milestones today, so there is nothing to audit yet. When the workflow is built:

- Record an entry, with `workspace: 'project'`, for each of: stage created, updated, status changed, put on hold, resumed and closed; milestone created, updated, dates or planned values changed, submitted, evidence added or replaced, approved, partially approved, rejected and resubmitted.
- Put the decision-maker's explanation in `reason`, and the previous and resulting status in `changes`.
- Keep submissions and decisions in their own history table. The `milestone` table holds only the latest `submitted_*`, `approved_*` and `rejection_reason`, which can't keep earlier submissions or link a resubmission to the one it replaces. The ERD has no such table yet.
- Decide first who may create stages and milestones, who submits and who approves, and what a partial approval records.
