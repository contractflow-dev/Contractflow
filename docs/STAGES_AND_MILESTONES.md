# Project workspace: Stages and Milestones

The backend for planning stages and milestones, submitting milestone work with evidence, and deciding on it. The frontend isn't built yet; this is the baseline for it.

## API

All routes are under `/api/contract`, with the `X-Company-Id` and `X-Contract-Id` headers. Every route needs a Project workspace role on the contract (`ContractAccessService.authorize(…, 'project')`); the queries use the scope it returns.

| Route | Who | Does |
|---|---|---|
| `GET stages`, `GET stages/:stageId` | Any Project role | Stages, with their client-approved `progressBps` |
| `POST stages`, `PATCH stages/:stageId` | Client Project Manager | Plan or change a stage |
| `POST stages/:stageId/transitions` | Client Project Manager | Start, hold, resume or complete a stage |
| `POST stages/:stageId/milestones` | Client Project Manager | Create a milestone in the stage |
| `GET milestones`, `GET milestones/:milestoneId` | Any Project role | Milestones (filters below) |
| `PATCH milestones/:milestoneId` | Client Project Manager | Change a milestone |
| `POST milestones/:milestoneId/start` | Contractor Project Lead | Start work |
| `POST milestones/:milestoneId/submissions` | Contractor Project Lead | Submit work with evidence |
| `GET milestones/:milestoneId/submissions[/:submissionId]` | Any Project role | Submission history, with evidence and decisions |
| `POST milestones/:milestoneId/submissions/:submissionId/decision` | Client Project Manager | Approve, partially approve or reject |
| `GET milestones/:milestoneId/decisions` | Any Project role | Decision history |
| `GET milestones/:milestoneId/outstanding-items` | Any Project role | Outstanding work and where it stands |

`GET milestones` filters, beside `page` and `limit`: `contractStageId`, `status`, `pendingReview` (the client's review queue), `overdue`, `dueFrom` and `dueTo` (days, on the revised due date if set), and `submittedFrom` and `submittedTo`.

- **Submission dates** come from the submission history: a milestone matches if any of its submissions, first or later, falls in the range. It's listed once however many match.
- Each bound is a calendar day (`2026-11-10`, the whole UTC day) or an instant with its time zone (`2026-11-10T08:30:00+01:00`). An instant without a zone, an invalid date or a range that ends before it starts is refused with 400, as the activity log filters do.
- The list is sorted by effective due date, then sequence, then id.

Other request and response fields:

- `dateOverrideReason` on `POST stages/:stageId/milestones`, `PATCH milestones/:milestoneId` and `PATCH stages/:stageId`: required when the planned dates fall outside the stage (rule 8).
- `legacyStatus` on every milestone: the status it had before the legacy transition, or null.
- Refusals by contract status are 409 (rule 6); missing date overrides are 400.

## Legacy milestones (rule 9)

1. **Inspect:** an authorized operator runs `docs/legacy-milestone-status-report.sql` against the database. It's read-only and rolled back. It shows each `active`, `delayed` or `at_risk` milestone with what it records, plus a hint for each.
2. **Decide** the mapping from that report. Allowed targets are only `planned` and `in_progress`; approved and completed milestones are never touched.
3. **Dry run:** `pnpm --filter @contractflow/api milestones:legacy-transition -- --map at_risk=in_progress [--map …] [--contract <id>]` prints the changes and what it skips, and changes nothing.
4. **Apply:** the same command with `--apply`. Every change is made in one transaction, or none is. Each moved milestone keeps its original status in `legacy_status`; running it again changes nothing.

The transition writes no activity entry: an activity entry needs an acting company member, and this is an operator action. `legacy_status` is its record.

## Activity log

Every change records an entry in the same transaction, with `workspace: 'project'`, the acting member and company, the record's id, and the reason where one was given. Readers see these entries only if they hold a Project role. Change sets and metadata never leave the API.

The shared contract lists the actions in groups: `STAGE_ACTIVITY_ACTIONS`, `MILESTONE_ACTIVITY_ACTIONS` and, among the milestone actions, `MILESTONE_DECISION_ACTIONS`.

| Action | Entity | Reason |
|---|---|---|
| `stage.created`, `stage.updated` | `contract_stage` | |
| `stage.status_changed` | `contract_stage` | Required to hold and to resume |
| `stage.completed` | `contract_stage` | |
| `milestone.created`, `milestone.updated`, `milestone.started` | `milestone` | |
| `milestone.submitted` (first), `milestone.resubmitted` (later) | `milestone` | |
| `milestone.evidence_attached` | `milestone` | |
| `milestone.approved` | `milestone` | |
| `milestone.partially_approved`, `milestone.rejected` | `milestone` | Required |
| `milestone.outstanding_items_updated` | `milestone` | |
| `milestone.completed` | `milestone` | |

### Labels the frontend will need

The contract activity feed (`apps/web/src/features/contracts/components/contract-activity.tsx`) has no labels for these actions yet. It falls back to the words after the dot ("Created", "Approved") and files them under "Contract". When the Project workspace is built:

- Add labels to `ACTION_LABEL`:

| Action | Label |
|---|---|
| `stage.created` | Stage added |
| `stage.updated` | Stage updated |
| `stage.status_changed` | Stage status changed |
| `stage.completed` | Stage completed |
| `milestone.created` | Milestone added |
| `milestone.updated` | Milestone updated |
| `milestone.started` | Work started |
| `milestone.submitted` | Milestone submitted |
| `milestone.resubmitted` | Milestone resubmitted |
| `milestone.evidence_attached` | Evidence attached |
| `milestone.approved` | Milestone approved |
| `milestone.partially_approved` | Milestone partially approved |
| `milestone.rejected` | Milestone rejected |
| `milestone.outstanding_items_updated` | Outstanding work accepted |
| `milestone.completed` | Milestone completed |

- Classify with the shared groups rather than by parsing the action: `STAGE_ACTIVITY_ACTIONS` → a "Stages" area, `MILESTONE_ACTIVITY_ACTIONS` → "Milestones".
- The entries have no link `target` yet; add one when the Project workspace has milestone pages to link to.

## Business rules

### Approved and enforced

- The client's Client Project Manager plans stages and milestones and decides on submissions; the contractor's Contractor Project Lead starts and submits work. Each is checked as an active role assignment on the caller's own party. Company Administrator and Workspace Admin rights grant neither.
- The side that submitted can never decide on the submission.
- Partial approval records the share accepted, the approved work, the outstanding items and a reason. With a target quantity, accepted and outstanding quantities must add up, and the share must match the accepted quantity.
- After a partial approval, a resubmission covers exactly the open outstanding items. Accepted work is never resubmitted or reopened.
- A rejection needs a reason, keeps nothing accepted from that submission, and the next submission links to it.
- Approval never invoices or pays.

### Approved on 22 November 2026

These were approved by the product owner on 22 November 2026, through the "Stages & Milestones Business Rules Approval". The approval covers implementing them; it doesn't authorise deployment, running migrations against production, or committing.

| # | Rule | Approved | In the code |
|---|---|---|---|
| 1 | Stage completion | A stage completes only when all its milestones are approved (cancelled ones excluded). | Already enforced |
| 2 | Weights | Stage weights in a contract, and milestone weights in a stage, each total at most 100%, checked on create and update. | Already enforced |
| 3 | Milestone scope | Frozen at the first submission; dates can change until approval. Changing scope needs a separate, authorised variation or reopening process, which doesn't exist yet. | Already enforced |
| 4 | Starting a milestone | Optional: the Contractor Project Lead may start a milestone to record its actual start; submitting doesn't require it. | Already enforced |
| 5 | Who submits | Any Contractor Project Lead on the contractor's side of the contract. A narrower rule would need a milestone-to-party assignment, never inferred from company membership. | Already enforced |
| 6 | Contract status | See the table below. | Implemented |
| 7 | Overdue | Due dates are judged by the contract's own time zone; timestamps stay in UTC. | Implemented |
| 8 | Dates within the stage | A milestone's planned start and due date must fall within its stage's planned dates; a stage's planned dates must keep containing its milestones' dates. The Client Project Manager may override either with a reason, recorded in the activity log. | Implemented |
| 9 | Legacy statuses | `active`, `delayed` and `at_risk` milestones are inspected first, then moved by an explicit, controlled transition that keeps the original status. Nothing is mapped automatically. | Tooling implemented; not run against any real database |

**Contract status (rule 6):**

| Contract | Planning (create and change stages and milestones) | Operations (start, hold, resume or complete a stage; start, submit or decide on a milestone) | Reads |
|---|---|---|---|
| Draft | Allowed | Refused | Allowed |
| Active | Allowed | Allowed | Allowed |
| Suspended | Refused | Refused | Allowed |
| Completed | Refused | Refused | Allowed |
| Archived | Refused | Refused | Not listed (existing archive behaviour) |

A refusal is a 409 naming the contract's status. Stage start, hold, resume and complete count as operations: they record what actually happened on site.

**Days (rule 7):** "today" for overdue milestones, the `overdue` filter, and the calendar days the workflow records (a milestone's actual start and completion dates, and a stage's actual start and end when no day is given) are all taken in the contract's `timezone`. If that time zone isn't a valid IANA name, UTC is used. Stored timestamps remain UTC.

**Date overrides (rule 8):** the revised due date isn't checked against the stage: it records a slip. A request that needs an override and has none is refused with 400 naming the dates; with `dateOverrideReason`, it's accepted, and the reason is stored on the activity entry with `metadata.dateOverride: true`. A reason sent when no override is needed is ignored.

## Notifications

### What exists

- A `notification` table and entity, and a `NotificationRepository` with one read (`findPageForRecipient`). Nothing writes to it, and no service or route uses it.
  - Its schema has the defects the milestone table had: `sent_at` and `read_at` are `NOT NULL` (so an unsent, unread notification can't be stored), and `entity_id` is a `uuid` (records use ULIDs).
  - Channels are `push`, `sms` and `email`; there is no in-app channel. Statuses are `sent`, `delivered`, `pending`, `failed` and `read`.
- `MailService` sends specific emails (verification, password reset, invitations) over SMTP or Resend, called directly from services, inside their transaction.
- No preferences, subscriptions, scheduler, job queue or delivery worker. The API has no scheduling package; Redis runs in the local Docker stack but nothing uses it.

So none of these exist yet: preferences, subscriptions, in-app notifications, notification history and read status, due-date reminders, overdue alerts, and notifying the right Client Project Manager and Contractor Project Lead.

### Proposed plan (a separate feature)

1. **Schema (migration):** make `sent_at` and `read_at` nullable; `entity_id` to `varchar(36)`; add an in-app channel; add `company_id` and a `dedupe_key` with a unique index; add a `notification_preference` table (member, notification type, channel, enabled).
2. **Recording (transactional outbox):** a `NotificationOutboxPort` on each Unit of Work context. The workflow writes `pending` notification rows in the same transaction as the change, like the activity entries. A failed operation leaves none.
3. **Recipients:** resolved in that transaction from explicit role assignments: active Client Project Managers on the client party for submissions and resubmissions; active Contractor Project Leads on the submitting party for decisions. Members who left and revoked roles are excluded; preferences filter the channel.
4. **Delivery:** an `EmailDeliveryAdapter` on `MailService` and an in-app channel that's just the stored row. A worker claims pending rows (`FOR UPDATE SKIP LOCKED`), sends them, and records `sent` or `failed` with a retry count and backoff. The unique `dedupe_key` (event, record, recipient, channel) makes a retry or a repeated event send once.
5. **Scheduled checks:** a daily job, either a scheduler module in the API or a Render cron job calling a protected internal route, that writes "due soon" and "overdue" notifications, deduplicated per milestone, day and recipient.
6. **API:** `GET /notifications` (the caller's own, paged), `POST /notifications/:id/read`, `GET`/`PUT /notification-preferences`. The existing notification bell would read from it.

Decisions needed first: which events notify whom by default, how many days before the due date to remind, and whether the delivery worker and scheduler run in the API process or as a separate Render service.

## Migrations and PostgreSQL

The two migrations of this work are `ActivityLogAuditFields1793700000000` and `MilestoneWorkflow1793800000000`.

**Production version: unknown.** The repository doesn't say which PostgreSQL version production uses. `render.yaml` takes `DATABASE_URL` from the Render dashboard and defines no database. The local Docker stack runs PostgreSQL 17, and the tracked dump (`contractflow_fresh_backup.dump`) was made with `pg_dump` 18.6 from a database called `contractflow_fresh`, which looks like a local database, not production. Check the version in the Render dashboard (or with `SELECT version();`) before deploying.

**Features the migrations need:**

| Feature | Minimum PostgreSQL |
|---|---|
| `ALTER TYPE … ADD VALUE` inside a migration's transaction (values not used in it) | 12 |
| `CREATE TRIGGER … EXECUTE FUNCTION` | 11 |

So both migrations need PostgreSQL 12 or later. `ActivityLogAuditFields`' rollback used `gen_random_uuid()`, which needs 13 (or the `pgcrypto` extension); it now builds the replacement UUIDs with `md5`, which every version has. Only its `down` changed.

**Existing data:**
- Nothing is deleted or rewritten. Columns become nullable; new columns start empty, except `approved_bps`.
- Milestones already `approved` or `completed` get `approved_bps` 10000 (fully accepted), so stage progress counts them. Other existing milestones start at 0.
- Existing statuses are kept. Milestones in `active`, `delayed`, `at_risk`, `completed` or `on_hold` can't be submitted until their status is moved to one the workflow accepts; no route does that yet.
- `entity_id` values in `activity_log` are kept as text.
- `milestone.legacy_status` starts empty for every row; the migration transitions nothing. Its revert refuses once any milestone has been transitioned, so no original status is lost.

**Rollback:** `MilestoneWorkflow` refuses to revert once workflow data exists (submissions, the new statuses, or empty optional columns), rather than lose it. With only legacy rows it reverts cleanly and restores the old schema and status values. `ActivityLogAuditFields` reverts by replacing record ids written since with fresh UUIDs, which is what writers stored before.

**Verified** on disposable PostgreSQL containers (never the development or production database): the full migration chain; revert of the workflow migration; legacy rows in the old schema (approved, at-risk and completed milestones); the workflow migration applied over them; the immutability trigger and the revert guard; revert with only legacy rows; revert of both migrations; and re-applying both. See "Verification by version" below.

### Verification by version

Each run, on a fresh container: the whole migration chain; revert of `MilestoneWorkflow`; legacy rows inserted in the old schema; `MilestoneWorkflow` applied over them; an update of a history row (refused by the trigger); a revert while workflow data exists (refused by the guard); revert with only legacy rows; revert of `ActivityLogAuditFields`; both applied again.

| PostgreSQL | Result |
|---|---|
| 12.22, 13.23, 14.25, 15.20, 16.16, 17.11, 18.7 | All passed, with the final migrations (including `legacy_status`, its revert guard, and the `md5` rollback of `ActivityLogAuditFields`) |

In every version, the legacy rows kept their titles, descriptions, amounts, statuses and notes; approved and completed milestones read 100% accepted and the at-risk one 0%; the stage and milestone status values were restored exactly by the revert; and 5 triggers were in place after each apply.

