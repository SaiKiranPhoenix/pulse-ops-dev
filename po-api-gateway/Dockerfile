# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY po-shared/package.json ./po-shared/package.json
COPY po-api-gateway/package.json ./po-api-gateway/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

COPY po-shared ./po-shared
COPY po-api-gateway ./po-api-gateway
RUN pnpm --filter @pulseops/shared build && pnpm --filter po-api-gateway build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/po-shared ./po-shared
COPY --from=build /repo/po-api-gateway/package.json ./po-api-gateway/package.json
COPY --from=build /repo/po-api-gateway/node_modules ./po-api-gateway/node_modules
COPY --from=build /repo/po-api-gateway/dist ./po-api-gateway/dist
WORKDIR /app/po-api-gateway
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
