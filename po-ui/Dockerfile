# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY po-ui/package.json ./po-ui/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

COPY po-ui ./po-ui
RUN pnpm --filter po-ui build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY po-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/po-ui/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
