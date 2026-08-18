# Codex Implementation Memory

Use this as the compact working memory for PulseOps implementation. The full source of truth remains the focused planning docs in `planning/`.

## Current Project State

- Repository is planning-only before implementation.
- Do not reread every planning file unless a task needs deep detail.
- Start coding from the vertical-slice roadmap in `planning/16_IMPLEMENTATION_ROADMAP.md` and backlog in `planning/21_CODING_BACKLOG.md`.

## Fixed Decisions

- Language: TypeScript.
- Backend: Express.
- Frontend: React/Next.js, Tailwind CSS, Socket.IO client, Recharts.
- Monorepo: pnpm workspaces using top-level `po-*` folders.
- Database: MongoDB.
- Cache/hot state: Redis.
- Queue: RabbitMQ.
- Realtime: Socket.IO.
- Load testing: k6.
- Infrastructure: Docker Compose, local-first, zero-cost.

## Architecture Rules

- Microservices-first boundaries, even if MVP starts with grouped runtime processes.
- API Gateway, Auth/Project, Dashboard Query, and Incident HTTP APIs may start in one Express process.
- Event workers, incident worker, audit worker, and heartbeat may start in one worker process.
- Vault logic must stay security-isolated in code structure.
- Each service owns its writes and collections.
- Shared utilities should live in a top-level `po-shared` folder only if/when needed; do not recreate `apps/`, `services/`, or `packages/` directories.
- Do not put service-specific database models in shared utilities.

## MVP Must-Haves

- Register/login/me.
- Project create/list/detail.
- API key create/list/rotate/disable, raw key returned once, hash stored.
- Ingestion for logs, errors, metrics.
- Redis API key cache, rate limiting, idempotency, dashboard cache, incident counters.
- RabbitMQ confirm publish, manual ack, retries, DLQ.
- Workers persist events to MongoDB and update Redis.
- Incidents for repeated errors and high p95 latency.
- Socket.IO live dashboard updates.
- Vault secrets encrypted with AES-256-GCM.
- Vault password derived key using Argon2id preferred, scrypt fallback acceptable.
- Vault integration tokens hashed at rest and raw token shown once.
- Audit logs for all sensitive vault operations.
- k6 scripts for normal traffic, burst, repeated errors, high latency, and rate limiting.

## Security Non-Negotiables

- Never store or log raw passwords, vault passwords, secret values, API keys, integration tokens, JWTs, authorization headers, cookies, or database URLs.
- Secret list APIs never return secret values.
- Vault reveal uses `POST`, not `GET`.
- Vault reveal/fetch responses must use no-store cache headers.
- Audit logs must contain safe identifiers only.
- Logs must use redaction by default.

## First Implementation Slice

1. Create pnpm TypeScript monorepo structure using `planning`, `po-ui`, and `po-{service-name}` folders.
2. Add Docker Compose infra for MongoDB, Redis, RabbitMQ, RabbitMQ management UI.
3. Add shared config, logger, errors, validation, contracts packages.
4. Build auth/project/API key flow.
5. Build log ingestion endpoint with Redis rate limit and RabbitMQ confirm publish.
6. Build worker consuming logs and persisting events.
7. Add minimal dashboard overview and live logs.

## Stop And Polish Demo Path

- register/login
- create project/API key
- run k6 repeated errors
- show queues and workers
- show live dashboard updates
- show incident auto-created
- create/reveal vault secret
- fetch secret with integration token
- show audit logs
