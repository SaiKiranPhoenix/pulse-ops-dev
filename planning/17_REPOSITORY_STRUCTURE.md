# PulseOps Repository Structure

## Decision

Use a pnpm TypeScript monorepo with Express services and shared packages.

## Top-Level Structure

```text
pulse-ops/
  apps/
    dashboard/
  services/
    api-gateway/
    auth-project-service/
    ingestion-service/
    event-workers/
    incident-service/
    realtime-gateway/
    vault-service/
    audit-service/
    ops-service/
  packages/
    config/
    logger/
    errors/
    validation/
    contracts/
    crypto-utils/
    rabbitmq/
    redis-utils/
    mongo-utils/
  infra/
    docker/
  scripts/
  tests/
    k6/
    integration/
  planning/
  docs/
```

## Folder Responsibilities

| Folder | Belongs Here | Does Not Belong Here |
| --- | --- | --- |
| `apps/dashboard` | UI routes, components, charts, socket client | backend business logic |
| `services/*` | service-specific APIs, workers, models, repositories | shared cross-service utilities |
| `packages/config` | env parsing and typed config | hardcoded secrets |
| `packages/logger` | structured logging and redaction | service-specific log messages |
| `packages/errors` | common error shape and helpers | business-specific policy |
| `packages/validation` | shared Zod helpers | service-owned schemas that are not public contracts |
| `packages/contracts` | API and queue payload contracts | database models |
| `packages/crypto-utils` | encryption wrappers and hashing helpers | vault business workflows |
| `packages/rabbitmq` | connection, publish, consume helpers | concrete worker handlers |
| `packages/redis-utils` | client and safe key helpers | feature-specific cache policy |
| `packages/mongo-utils` | connection helpers | collection ownership shortcuts |
| `infra/docker` | compose files and local infra config | application source |
| `scripts` | seed, reset, index setup, demo helpers | destructive broad filesystem commands |
| `tests/k6` | load tests | unit tests |
| `planning` | architecture markdown | code |
| `docs` | generated diagrams and user-facing docs | secrets |

## Workspace Choice

Use pnpm workspaces because:

- fast installs
- strict dependency boundaries
- good monorepo ergonomics
- common in modern TypeScript repos

## Express Structure Per Service

Each HTTP service should follow:

```text
src/
  app.ts
  server.ts
  routes/
  controllers/
  services/
  repositories/
  models/
  middleware/
  schemas/
  health/
```

Worker services should follow:

```text
src/
  index.ts
  consumers/
  handlers/
  repositories/
  heartbeat/
  retry/
```

## Shared Validation

- Use Zod for public API bodies, query params, and queue payloads.
- Store public contract schemas in `packages/contracts`.
- Store internal service schemas inside the owning service.

## Environment Strategy

- Commit `.env.example`.
- Do not commit `.env`.
- Validate env at service startup with typed config.
- Use separate env prefixes where useful: `API_`, `INGESTION_`, `VAULT_`, `RABBITMQ_`.

## Linting And Formatting

- ESLint for TypeScript.
- Prettier for formatting.
- `tsc --noEmit` for type checks.
- Shared base config under package or root config.

## README Structure

Root README should include:

- project headline
- architecture diagram
- quick start
- demo path
- service overview
- queue strategy
- Redis strategy
- vault security strategy
- incident detection
- load testing evidence
- screenshots
- failure scenarios
- interview talking points
- resume bullets

## Migration Compatibility

If services start grouped in one process:

- keep route modules and service modules separable.
- do not import private repositories across logical service boundaries.
- keep queue contracts stable.
- keep collection ownership documented.
