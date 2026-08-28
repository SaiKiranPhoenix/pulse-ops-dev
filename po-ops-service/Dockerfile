# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY po-shared/package.json ./po-shared/package.json
COPY po-ops-service/package.json ./po-ops-service/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

COPY po-shared ./po-shared
COPY po-ops-service ./po-ops-service
RUN pnpm --filter @pulseops/shared build && pnpm --filter po-ops-service build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/po-shared ./po-shared
COPY --from=build /repo/po-ops-service/package.json ./po-ops-service/package.json
COPY --from=build /repo/po-ops-service/node_modules ./po-ops-service/node_modules
COPY --from=build /repo/po-ops-service/dist ./po-ops-service/dist
WORKDIR /app/po-ops-service
USER node
EXPOSE 4150
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const port = process.env.PORT || '4150'; fetch('http://127.0.0.1:' + port + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
