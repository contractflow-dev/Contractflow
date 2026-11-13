# ContractFlow

ContractFlow is a contract operations platform for oil and gas projects. Client
and contractor companies work on a shared contract, and each company's members
get access only to the contract workspaces and roles they have been assigned.

This repository is a pnpm workspace containing the NestJS API, the Next.js web
app, shared packages and the local infrastructure.

## Repository structure

| Path                        | Contents                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                  | NestJS REST API using TypeORM and PostgreSQL. See [`apps/api/README.md`](apps/api/README.md) for endpoints, authentication, email and document storage. |
| `apps/web`                  | Next.js (App Router) web app using Redux Toolkit and RTK Query.                                                                                         |
| `packages/contracts-schema` | `@contractflow/contracts-schema`: API request/response types and shared enums used by both apps.                                                        |
| `packages/ui`               | `@workspace/ui`: shared UI components.                                                                                                                  |
| `packages/db/docs`          | Entity relationship diagram and user stories (documentation only, not a package).                                                                       |
| `infra`                     | Docker Compose file for local services and the containerised app.                                                                                       |
| `docs`                      | Progress reports, UI guides and assessments.                                                                                                            |
| `render.yaml`               | Render deployment for the API and web app.                                                                                                              |

Before changing code, read
[`CONTRACTFLOW_ENGINEERING_RULES.md`](CONTRACTFLOW_ENGINEERING_RULES.md). It
describes the module layout, the scoped repositories, and how company and
contract access is enforced.

## What the application does

- **Accounts:** registration, email verification, sign-in with a server-side
  session cookie, and password reset.
- **Companies:** company onboarding, company email verification, members, and
  email invitations with Company Administrator and Member roles.
- **Contracts:** contract creation and lifecycle (activate, hold, resume,
  complete), sites, signatories and status history. Other verified companies
  are invited to join as client, contractor, subcontractor, vendor or other
  party.
- **Workspaces and roles:** each contract has Project, HSE and Finance
  workspaces. Members get access through contract role assignments or email
  role invitations, and workspace administrators manage their own workspace.
- **Operational records:** delivery, financial, HSE, compliance and
  site-operations records for each contract, plus an activity history.
- **Documents:** contract and company documents stored in Amazon S3 (or an
  S3-compatible service), uploaded and downloaded through presigned URLs.
- **Platform administration:** an overview for platform administrators.

Access is checked in the API. The active company is sent in the
`X-Company-Id` header, and the active contract in the `X-Contract-Id` header.
Contracts are visible only to companies that are parties to them.

## Prerequisites

- Node.js 20 or later (the Docker images use Node.js 22)
- pnpm 9.15.0 (`corepack enable` installs the version pinned in `package.json`)
- Docker Desktop or Docker Engine with Docker Compose

## Local development setup

1. Start the backing services:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

   This starts PostgreSQL 17 (`5432`), Redis (`6379`), MinIO (S3 API `9000`,
   console `http://localhost:9001`) and Mailpit (SMTP `1025`, web UI
   `http://localhost:8025`). The one-off `minio-init` container creates the
   `contractflow-local` bucket. Sign in to the MinIO console as `contractflow`
   with password `contractflow-secret`.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create the API environment file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

   Set `JWT_SECRET` to a value of at least 32 characters. The rest of the
   example settings work with the local services. Every setting is described
   in `apps/api/.env.example`.

   Document uploads need S3 storage. To use the local MinIO, set
   `S3_BUCKET_NAME=contractflow-local` and `S3_ENDPOINT=http://localhost:9000`,
   with `AWS_ACCESS_KEY_ID=contractflow` and
   `AWS_SECRET_ACCESS_KEY=contractflow-secret`. To use Amazon S3 instead,
   leave `S3_ENDPOINT` empty and sign in with an AWS profile that can reach
   `S3_BUCKET_NAME`.

4. Create the database schema:

   ```bash
   pnpm --filter @contractflow/api migration:run
   ```

5. Start the API and the web app, each in its own terminal:

   ```bash
   pnpm run dev:api
   pnpm run dev:web
   ```

   `dev:api` also starts the Mailpit container if it isn't running. The web app
   calls `http://localhost:3001/api` unless `NEXT_PUBLIC_API_URL` is set.

6. Open the app:

   - Web app: `http://localhost:3000`
   - API: `http://localhost:3001/api` (health check: `http://localhost:3001/health`)
   - Captured email: `http://localhost:8025`

In development, all email goes to Mailpit, including verification, password
reset and invitation emails. Every email is sent as HTML with a plain text
alternative, built from the shared template in
`apps/api/src/modules/mail/email.template.ts`.

To make a registered user a platform administrator, build the API and run:

```bash
pnpm --filter @contractflow/api build
pnpm --filter @contractflow/api admin:promote <user-email>
```

### Running the whole app in Docker

The `app` profile builds the API and web images, runs the migrations and
starts both apps, using Mailpit for email:

```bash
docker compose -f infra/docker-compose.yml --profile app up -d --build
```

`infra/dev-docker.env` changes the host ports (`WEB_PORT`, `API_PORT`) when
used with `--env-file`. `pnpm run dev:docker` does this with that file: it
builds and starts the web container, and the API and migration containers it
depends on.

## Common scripts

Run these from the repository root:

| Command                                             | What it does                                                |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm run dev:api`                                  | API in watch mode on port 3001                              |
| `pnpm run dev:web`                                  | Web app in development mode on port 3000                    |
| `pnpm run build`                                    | Builds every workspace package                              |
| `pnpm run lint`                                     | Lints every workspace package                               |
| `pnpm run format`                                   | Formats the repository with Prettier                        |
| `pnpm --filter @contractflow/api test`              | API unit tests (Vitest)                                     |
| `pnpm --filter @contractflow/api test:architecture` | Checks that application services don't use TypeORM directly |
| `pnpm --filter @contractflow/api test:integration`  | API integration tests against PostgreSQL                    |
| `pnpm --filter @contractflow/web test`              | Web tests (Vitest)                                          |
| `pnpm --filter @contractflow/api migration:run`     | Applies pending database migrations                         |
| `pnpm --filter @contractflow/api migration:revert`  | Reverts the most recent migration                           |

Integration tests need `TEST_DATABASE_URL` pointing at a separate database
whose name starts with `contractflow_test`. The tests refuse to run against any
other database.

Migrations live in `apps/api/src/common/database/migrations` and only run
if they are listed in `registered-migrations.ts`.

## Continuous integration and deployment

- GitHub Actions (`.github/workflows/application-ci.yml`) installs with
  `pnpm install --frozen-lockfile` and builds every package.
- Render (`render.yaml`) deploys `contractflow-api` and `contractflow-web`.
  The API runs its migrations on start and uses `/health` as its health check.
- Production sends email through Resend (`MAIL_PROVIDER=resend`,
  `RESEND_API_KEY`, `EMAIL_FROM`) and requires `WEB_URL`.

Only the root `pnpm-lock.yaml` is used. Don't commit `package-lock.json`,
`yarn.lock`, or a `pnpm-lock.yaml` inside an app or package.
