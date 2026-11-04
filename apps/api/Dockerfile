# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t contractflow-api .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Every workspace manifest is needed for a frozen install against the shared lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts-schema/package.json packages/contracts-schema/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@contractflow/api..."

COPY packages/contracts-schema packages/contracts-schema
COPY apps/api apps/api
RUN pnpm --filter "@contractflow/api..." build

# Self-contained production bundle: api package + prod deps + built workspace deps.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @contractflow/api deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main"]
