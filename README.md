# ContractFlow

ContractFlow is a monorepo for an oil and gas contract operations platform. The repository combines a NestJS API, a Next.js frontend, shared contract types, and the infrastructure needed to run the app locally.

## Repository structure

- `apps/api`: NestJS REST API built with TypeORM and PostgreSQL.
- `apps/web`: Next.js frontend for the dashboard and user-facing workflows.
- `packages/contracts`: shared TypeScript domain and contract definitions.
- `infra`: Docker Compose setup for local PostgreSQL, Redis, and MinIO services.
- `render.yaml`: deployment configuration for hosting.

## Application architecture

ContractFlow follows a simple monorepo structure:

- The backend exposes API endpoints under the `/api` prefix.
- The frontend consumes the API and renders operational dashboards.
- Shared contract types live in `packages/contracts/src/index.ts` so both apps can rely on the same domain model.
- Local services are defined in `infra/docker-compose.yml` so the application can run without external dependencies.

## Prerequisites

- Node.js 20+
- npm (or pnpm if preferred)
- Docker Desktop or Docker Engine

## Local development setup

1. Start the required services:

```bash
docker compose -f infra/docker-compose.yml up -d
```

2. Install workspace dependencies:

```bash
npm install
```

3. Create the API environment file:

```bash
# apps/api/.env
DATABASE_URL=postgresql://contractflow:contractflow@localhost:5432/contractflow
PORT=3001
WEB_URL=http://localhost:3000
```

4. Run the API:

```bash
npm run dev:api
```

5. Run the web application:

```bash
npm run dev:web
```

6. Open the app in the browser:

- Web app: `http://localhost:3000`
- API base URL: `http://localhost:3001/api`

## Common workspace scripts

From the repository root:

```bash
npm run build
npm run lint
```

## Current project status

This repository is structured as a working monorepo scaffold for ContractFlow. The API and web app are in place, and the shared contract layer is intentionally lightweight and ready to expand as the application grows.
