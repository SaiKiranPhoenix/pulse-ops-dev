# syntax=docker/dockerfile:1.7

FROM node:22-alpine
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY po-shared/package.json ./po-shared/package.json
COPY po-api-gateway/package.json ./po-api-gateway/package.json
COPY po-auth-project-service/package.json ./po-auth-project-service/package.json
COPY po-ingestion-service/package.json ./po-ingestion-service/package.json
COPY po-event-workers/package.json ./po-event-workers/package.json
COPY po-incident-service/package.json ./po-incident-service/package.json
COPY po-ops-service/package.json ./po-ops-service/package.json
COPY po-vault-service/package.json ./po-vault-service/package.json
COPY po-audit-service/package.json ./po-audit-service/package.json
COPY po-realtime-gateway/package.json ./po-realtime-gateway/package.json
COPY po-backend/package.json ./po-backend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

COPY po-shared ./po-shared
COPY po-api-gateway ./po-api-gateway
COPY po-auth-project-service ./po-auth-project-service
COPY po-ingestion-service ./po-ingestion-service
COPY po-event-workers ./po-event-workers
COPY po-incident-service ./po-incident-service
COPY po-ops-service ./po-ops-service
COPY po-vault-service ./po-vault-service
COPY po-audit-service ./po-audit-service
COPY po-realtime-gateway ./po-realtime-gateway
COPY po-backend ./po-backend

RUN pnpm --filter @pulseops/shared build

WORKDIR /app/po-backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const port = process.env.PORT || '4000'; fetch('http://127.0.0.1:' + port + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["pnpm", "start"]
