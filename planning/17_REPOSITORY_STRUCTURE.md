# PulseOps Repository Structure

## Decision

Use a pnpm TypeScript monorepo with top-level `po-*` deployable services and `po-shared`.

## Top-Level Structure

```text
pulse-ops/
  po-ui/
  po-api-gateway/
  po-auth-project-service/
  po-ingestion-service/
  po-event-workers/
  po-incident-service/
  po-realtime-gateway/
  po-vault-service/
  po-audit-service/
  po-ops-service/
  po-shared/
  planning/
  docs/
  scripts/
  compose.yaml
```

## Folder Responsibilities

| Folder | Belongs Here | Does Not Belong Here |
| --- | --- | --- |
| `po-ui` | UI routes, components, charts, socket client | backend business logic |
| `po-*-service` | service-specific APIs, workers, models, repositories | shared cross-service utilities |
| `po-api-gateway` | public API edge and routing | domain persistence owned by other services |
| `po-event-workers` | queue consumers and event processing | HTTP ingestion admission |
| `po-vault-service` | secret encryption and vault APIs | telemetry processing |
| `po-shared` | env parsing, contracts, logger, errors, validation, safe shared helpers | service-owned schemas, repositories, or business workflows |
| `compose.yaml` | local infra and app service orchestration | source code |
| `scripts` | seed, reset, index setup, demo helpers | destructive broad filesystem commands |
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
  config/
  routes/
  controllers/
  services/
  repositories/
  models/
  middlewares/
  validators/
  events/
    publishers/
    consumers/
  sockets/
  utils/
  types/
  errors/
```

Worker services use the same structure; `server.ts` is the worker runtime entry point.

## Shared Validation

- Use Zod for public API bodies, query params, and queue payloads.
- Store public contract schemas in `po-shared/src/contracts`.
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

## Deployment Compatibility

Every `po-*` runtime has its own Dockerfile and Compose service. Do not merge service runtimes. Start only the subset needed during local development, but keep each service independently deployable and scalable.
