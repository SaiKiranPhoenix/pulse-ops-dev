# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY po-shared/package.json ./po-shared/package.json
COPY po-vault-service/package.json ./po-vault-service/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY po-shared ./po-shared
COPY po-vault-service ./po-vault-service
RUN pnpm --filter @pulseops/shared build && pnpm --filter po-vault-service build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/po-shared ./po-shared
COPY --from=build /repo/po-vault-service/package.json ./po-vault-service/package.json
COPY --from=build /repo/po-vault-service/dist ./po-vault-service/dist
WORKDIR /app/po-vault-service
USER node
EXPOSE 4200
CMD ["node", "dist/server.js"]
