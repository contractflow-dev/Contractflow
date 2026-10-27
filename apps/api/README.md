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
`GET /api/companies/:companyId/membership`, and the administrator-only
`GET /api/companies/:companyId/dashboard`.

The company-admin dashboard shows active contracts expiring within
`COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS` days (default `30`, allowed range `1` to
`365`) and up to five contracts updated in the last 30 days. Expiry uses the
revised end date when present, otherwise the scheduled end date; contracts
without an effective end date are not included in expiry results.

Company Admins can manage active contract-role assignments with
`GET /api/companies/:companyId/contracts/:contractId/role-assignments?workspace=project|hse|finance`,
`POST` on the same path, and
`DELETE /api/companies/:companyId/contracts/:contractId/role-assignments/:assignmentId`.
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
