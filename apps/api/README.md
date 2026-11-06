<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Authentication and email delivery

The API uses an opaque, server-side session stored in the
`contractflow_session` HTTP-only cookie. Configure `DATABASE_URL` and
`SESSION_TTL_DAYS` (defaults to 7). In production, set `NODE_ENV=production` so
the session cookie is marked `Secure`, and set `WEB_URL` to the exact frontend
origin allowed to send credentialed requests.

Verification messages use Mailpit over SMTP in non-production environments by
default (`SMTP_HOST=localhost`, `SMTP_PORT=1025`). Set `MAIL_PROVIDER=smtp` to
select SMTP explicitly, and open `http://localhost:8025` to view captured
messages. The local API commands (`start`, `start:dev`, and `start:debug`) start
the Mailpit container automatically; Docker Compose must be installed and
running. Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` (a
sender verified with Resend) to use Resend instead. Production defaults to
Resend and requires those values. `WEB_URL` defaults to
`http://localhost:3000` outside production and must be set for production.
Registration and the verification token are committed before delivery, so a
failed delivery can be retried with `POST /api/auth/resend-verification`.

The identity endpoints are `POST /api/auth/register`,
`POST /api/auth/login`, `POST /api/auth/verify-email`,
`POST /api/auth/resend-verification`, `POST /api/auth/logout`, and the
authenticated `GET /api/users/me`. Company endpoints are authenticated
`POST /api/companies`, `GET /api/companies`, `GET /api/companies/current`,
`GET /api/companies/access-summary`, `GET /api/company/membership`, and the
administrator-only `GET /api/company/dashboard`. The access summary tells a
user with no active company whether they are new, were removed from a
company, or belong to an inactive company. It returns only counts and flags,
not company names or IDs.

A company must verify its company email before other companies can invite it
to a contract, because contract invitations find the company by that email.
Creating a company, or changing its email, sends a one-time link (valid for
7 days) to the company email. The public `POST /api/companies/verify-email`
takes the link's token. Administrators can request a new link with
`POST /api/company/verification-email`, at most once a minute. Only one
verified company may use each email address.

Company and contract IDs are never part of the URL. Company-scoped routes
(`/api/company/...`, `/api/contracts`) take the company from the
`X-Company-Id` header. Single-contract routes (`/api/contract/...`) also take
the contract from the `X-Contract-Id` header. Both must be ULIDs. The API
rejects either ID when it is sent as a query or path parameter.

The company-admin dashboard shows active contracts expiring within
`COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS` days (default `30`, allowed range `1` to
`365`) and up to five contracts updated in the last 30 days. Expiry uses the
revised end date when present, otherwise the scheduled end date; contracts
without an effective end date are not included in expiry results.

Company Admins can manage active contract-role assignments with
`GET /api/contract/role-assignments?workspace=project|hse|finance`,
`POST` on the same path, and
`DELETE /api/contract/role-assignments/:assignmentId`.
The `POST` body contains `companyUserId` and `role`, and the role must belong to
the selected workspace.
Assignments are limited to active members of the actor's company and are
audited; revocation preserves the assignment history. Workspace Admin is a
separate privilege from representative roles, and contract-role invitations
are accepted before they create an assignment. Contract creation, editing,
workspace availability, archiving, restoration, and company-party invitations
are restricted to a Company Admin of the creating company. Active project
leads can transition contracts between draft/active/suspended/completed states;
each transition requires a reason and writes status history and an activity
event.

The session guard is registered globally and protects routes by default.
Only controllers or handlers explicitly marked public (currently the auth
controller) bypass session validation; future API controllers must not opt out
unless the endpoint is intentionally unauthenticated.

Run `pnpm run migration:run` from `apps/api` to apply the TypeORM migrations
before deploying schema changes. The migration DataSource explicitly disables
schema synchronization. The execution order is the identity bootstrap,
authentication and company-admin migrations, the historical domain-schema
migration, role-assignment corrections and invitation migrations, and finally
the contract-lifecycle and company-invitation-expiry-index migrations. The
identity bootstrap verifies the expected
identity tables, columns, primary keys, foreign keys, and unique keys before it
no-ops on an existing schema; partial or incompatible schemas fail with an
actionable error. The later corrections remain after the historical domain
migration because they depend on its contract tables. Validate migrations only
against an isolated disposable PostgreSQL database; do not use a development
or shared database as a migration test target. Company and
initial-administrator rows are created within one transaction; the database
unique index prevents duplicate company/user memberships.

### Planning recovery for a mixed migration state

The recovery planner is read-only. It never executes migrations, writes
migration history, or repairs schema. It is deliberately separate from API
startup and the normal migration commands.

Set `MIGRATION_RECOVERY_DATABASE_URL` to the deliberate target and invoke the
planner explicitly:

```powershell
$env:MIGRATION_RECOVERY_DATABASE_URL = "<operator-supplied-target-url>"
pnpm --filter @contractflow/api migration:recovery:plan -- --plan
```

The planner requires both an explicit `MIGRATION_RECOVERY_DATABASE_URL` and a
configured `DATABASE_URL`; it never uses `DATABASE_URL` as the recovery target.
It refuses URLs with matching normalized host, port, and database identity,
and rejects connection parameters that can override those identity fields.
This is an offline comparison: it cannot resolve DNS aliases, prove that
different hostnames do not reach the same PostgreSQL server, identify proxies,
or prove physical server separation. Operators must independently identify the
target before running the planner.

The planner's DataSource explicitly sets `synchronize: false` and
`migrationsRun: false`; API runtime and CLI DataSources do the same. The
planner opens a repeatable-read, read-only transaction and emits sanitized
target identity, migration history, schema probes, data-precheck counts, and
the first unresolved migration. Do not put credentials in command arguments
or logs.

`CONFLICTING_OR_UNKNOWN` means the planner cannot prove every effect of a
migration from its current manifest. It is not permission to mark the
migration applied or to run a repair. At present, only
`NullableActivityRequestContext1791882600002` and
`CompanyInvitationExpiryIndex1792862700001` and
`CompanyInvitationOptionalNames1793100000000` have complete structural
verification. The other eight registered migrations are explicitly marked
partial, and the planner fails closed for them even when the implemented
probes pass. An incomplete probe blocks readiness because its result cannot
prove the migration's full effects. No recovery execution is implemented.

The planner's structural snapshot covers user schemas, relations, column
definitions/defaults, constraints and validation state, indexes and catalog
validity flags, enum labels/order, extensions, sequence definitions, and
TypeORM migration-history structure and rows. It deliberately excludes
ordinary table data (except migration-history rows), sequence current values,
functions, triggers, and server-level configuration. A matching snapshot is
not proof that data transformations or all database behavior are unchanged.

PostgreSQL integration tests create and drop databases. They require deliberate
configuration of `TEST_POSTGRES_URL`,
`CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS=1`,
`CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST=host:port`, `DATABASE_URL`,
`CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER`, and
`CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER`. Obtain both PostgreSQL system
identifiers independently from trusted infrastructure inventory; they must be
different. Before creating any database, the harness opens a read-only
transaction to the test endpoint, verifies the connected server's
`pg_control_system().system_identifier`, and confirms it matches the approved
disposable identifier and differs from the API server identifier. Failure to
read or match the identity stops the test before destructive operations.

The allowlisted test endpoint must also differ from the application endpoint.
Tests create uniquely named `cf_plan_test_*` databases without dropping a
pre-existing database; cleanup only drops database names successfully created
and tracked by that test run. Offline hostname comparison cannot detect DNS
aliases; the server-identifier comparison is an additional guard, not
authorization to use a development, production, or shared server. The complete
disposable server must be independently verified and isolated before opting in.
When no integration-test settings are supplied, the PostgreSQL integration
suite is skipped; a partially configured environment fails before connecting.
Type-check the disposable test harness without changing the production build's
TypeScript inputs by running `pnpm exec tsc -p tsconfig.test.json --noEmit`
from `apps/api`.

Before a database-specific recovery plan can be considered, independently
verify a restorable backup, identify the target, and compare its actual schema,
data preconditions, and migration history with every migration. Record missing,
conflicting, and already-present effects and review a checkpointed sequence
with rollback considerations. Any schema or migration-history mutation
requires separate explicit approval. Do not use `migration:run` as a recovery
mechanism on a mixed-state database.

Example report fragment (illustrative and sanitized; not produced by a run
against the configured development database):

```json
{
  "mode": "read-only-plan",
  "target": {
    "database": "audited_scenario",
    "schema": "public",
    "serverAddress": "127.0.0.1",
    "serverPort": 5432,
    "databaseUser": "migration_planner"
  },
  "migrations": [
    {
      "name": "IdentitySchemaBootstrap1749000000000",
      "recorded": false,
      "status": "CONFLICTING_OR_UNKNOWN",
      "limitations": [
        "Column types, nullability, defaults, every index, enum definitions, and extension ownership are not exhaustively compared."
      ]
    }
  ],
  "proposedPlan": {
    "safeToExecute": false,
    "executionImplemented": false,
    "stopAt": "IdentitySchemaBootstrap1749000000000"
  }
}
```

## Document storage (Amazon S3)

Contract documents are stored in a private S3 bucket. The browser uploads and
downloads files directly through short-lived presigned URLs. The API never
proxies file bytes and never returns AWS credentials.

| Location | Responsibility |
| --- | --- |
| `src/common/storage/` | `IObjectStorage` port (`OBJECT_STORAGE` token), the S3 implementation, client configuration and error mapping. One `S3Client` is shared and destroyed on shutdown. |
| `src/modules/cross-cutting/services/document.service.ts` | Authorization, upload lifecycle, versions, deletion and audit. It depends on the port, not the AWS SDK. |
| `src/modules/cross-cutting/services/document-file-policy.ts` | File allowlist, file-signature checks, file-name sanitizing and storage-key generation. |

### Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `AWS_REGION` | yes | — | `eu-north-1` |
| `S3_BUCKET_NAME` | yes | — | `contractflow-app-storage-191518190571` |
| `S3_ENDPOINT` | no | unset | S3-compatible endpoint for local work, such as MinIO. Leave unset for AWS. |
| `S3_FORCE_PATH_STYLE` | no | on when `S3_ENDPOINT` is set | |
| `DOCUMENT_MAX_UPLOAD_BYTES` | no | `26214400` (25 MB) | Up to 5 GiB (the single-PUT limit) |
| `DOCUMENT_UPLOAD_URL_TTL_SECONDS` | no | `300` | 60–3600 |
| `DOCUMENT_DOWNLOAD_URL_TTL_SECONDS` | no | `60` | 10–900 |

The API refuses to start if the region or bucket is missing or malformed.
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are **not** configuration
settings; do not add them to production environments.

### Credentials

The S3 client uses the AWS SDK default credential provider chain and never
overrides it.

- **Production (ECS/Fargate):** credentials come from the task role
  `ContractFlowEcsTaskRole` (policy `ContractFlowS3AppStoragePolicy`). The SDK
  refreshes them automatically. The task needs a route to S3, either through
  NAT or through an S3 gateway VPC endpoint.
- **Local development:** use an AWS CLI profile or SSO session, for example
  `aws sso login --profile contractflow`, then start the API with
  `AWS_PROFILE=contractflow`. For MinIO, set `S3_ENDPOINT` and the standard
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in your shell, never in a
  committed file.

### Required bucket and IAM configuration

The integration assumes the following. Confirm each item; none can be
verified from code.

- **Block Public Access** is on, and objects are private. URLs are presigned
  per request.
- **IAM permissions** for the task role on `arn:aws:s3:::<bucket>/companies/*`:
  `s3:PutObject` (presigned uploads), `s3:GetObject` (HeadObject, file
  signature reads and presigned downloads) and `s3:DeleteObject`.
  - `s3:ListBucket` on the bucket is recommended. Without it, S3 answers
    HeadObject for a not-yet-uploaded file with `403` instead of `404`, and
    "complete upload" reports storage as unavailable instead of "not uploaded
    yet".
- **CORS** must allow the web origin to PUT directly. For example:

  ```json
  [
    {
      "AllowedOrigins": ["https://<web-origin>"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type", "x-amz-checksum-sha256"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

- **Versioning** is optional. When it is on, the verified object version ID
  is recorded on the document version, and deletes add a delete marker that
  lifecycle rules can expire.
- **SSE-S3 or SSE-KMS** default bucket encryption is recommended. If SSE-KMS
  is used, the task role also needs `kms:GenerateDataKey` and `kms:Decrypt` on
  the key.

### Object keys

```text
companies/{companyId}/contracts/{contractId}/documents/{documentId}/{versionId}.{ext}
```

Keys are generated only by the backend, from the authorized company and
contract scope and server-generated ULIDs. Original file names are stored in
the database, never in keys, and clients cannot supply keys. Key prefixes are
not an authorization mechanism; access is enforced by `ContractAccessService`
and the document repository scope.

### API

All routes require a session plus the `X-Company-Id` and `X-Contract-Id`
headers. Scope IDs are never accepted in paths, query strings or bodies.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/contract/documents?page&limit` | List visible documents |
| POST | `/api/contract/documents/upload-url` | Create a document and get a presigned PUT for version 1 |
| GET | `/api/contract/documents/:documentId` | Document metadata and versions |
| POST | `/api/contract/documents/:documentId/versions/upload-url` | Get a presigned PUT for a new version (owner company) |
| POST | `/api/contract/documents/:documentId/versions/:versionId/complete` | Verify the uploaded object and make the version available |
| GET | `/api/contract/documents/:documentId/download-url?versionId` | Short-lived presigned GET (latest available version by default) |
| DELETE | `/api/contract/documents/:documentId` | Soft-delete the document and remove its objects (owner company), `204` |

Request and response types are in `@contractflow/contracts-schema`
(`CreateDocumentUploadRequest`, `DocumentUploadSession`, `DocumentDetail`, and
so on).

**Access rules.** Every call goes through `ContractAccessService.authorize`,
which requires active company membership, contract-party status and a contract
role. The workspace depends on the document category: `HSE` requires the `hse`
workspace, `invoice` requires `finance`, and every other category accepts any
contract role. Company administrators get no implicit bypass.

`private` documents are visible only to the owner company. `public` documents
are readable by every party to the contract. Uploading versions, completing
uploads and deleting are owner-company only.

### Upload workflow

1. The browser computes the file's SHA-256 (`sha256Hex` in
   `apps/web/src/lib/presignedUpload.ts`).
2. `POST …/upload-url` with title, category, visibility, `fileName`,
   `mimeType`, `sizeBytes` and `checksumSha256`. The API validates the file,
   authorizes the caller and creates the document and a version in
   `pending_upload`. It returns `upload.url`, `upload.method` (`PUT`) and
   `upload.headers`.
3. The browser PUTs the file to `upload.url` with exactly `upload.headers`.
   The URL signs `Content-Type`, `Content-Length` and
   `x-amz-checksum-sha256`, so S3 rejects any body with a different type, size
   or checksum.
4. `POST …/versions/:versionId/complete`. The API moves the version to
   `processing`, checks that the object exists with the signed size, type and
   checksum, and checks the file signature (magic bytes). It then marks the
   version `available`, or `failed` and deletes the object. If the object
   hasn't arrived yet, the call returns `409` and the upload stays retryable.
   Once the upload URL has expired with no object, the version is marked
   `failed`.

Only `available` versions can be downloaded. Malware scanning is not yet
implemented. If required, add it between `processing` and `available` (for
example with GuardDuty Malware Protection for S3).

### File validation

The extension and declared MIME type must both match the allowlist:
`pdf`, `png`, `jpg`/`jpeg`, `docx`, `xlsx`, `pptx`, `csv` and `txt`. The
stored `Content-Type` comes from the allowlist, not from the browser.
Macro-enabled and legacy binary Office formats, archives, executables, HTML
and SVG are rejected. File names have path segments and control characters
stripped. Size must be between 1 byte and `DOCUMENT_MAX_UPLOAD_BYTES`.

### Audit trail

`activity_log` records `document.upload_initiated`,
`document.upload_completed`, `document.version_added`,
`document.upload_failed`, `document.downloaded` and `document.deleted`, with
the document and version IDs in `metadata`. Denied access attempts are logged
server-side, because `activity_log` requires a company membership.
Presigned URLs, credentials and file contents are never logged.

### Testing

- Unit tests mock the AWS SDK:
  `pnpm --filter @contractflow/api test -- src/common/storage src/modules/cross-cutting`
- PostgreSQL integration tests (migration, scoping, lifecycle, soft delete)
  need `TEST_DATABASE_URL`: `pnpm --filter @contractflow/api test:integration`
- An opt-in live check against a non-production bucket or MinIO runs only when
  `TEST_S3_BUCKET` is set. It covers a presigned PUT, a tampered body and type
  being rejected, a presigned GET and a delete:
  `TEST_S3_BUCKET=<test-bucket> TEST_S3_REGION=eu-north-1 pnpm --filter @contractflow/api test:integration -- test/integration/storage`

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
