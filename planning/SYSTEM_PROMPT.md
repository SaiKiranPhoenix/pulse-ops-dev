# PulseOps Codex Planning And Development Rulebook

This document is the controlling instruction set for planning and implementing PulseOps with Codex. It replaces the earlier prompt playbook.

## Mission

Build PulseOps as a recruiter-grade, local-first developer operations platform that demonstrates real backend architecture:

- real-time observability ingestion
- asynchronous worker processing
- Redis-backed caching, rate limiting, idempotency, counters, and locks
- RabbitMQ retry and dead-letter patterns
- encrypted developer secrets vault
- audit logging
- live dashboards with WebSockets
- failure handling and load testing

The project must feel like a serious platform, not a CRUD demo.

## Non-Negotiable Rules

1. Do not write implementation code until the user explicitly asks to start implementation.
2. Keep planning artifacts in markdown under `planning/`.
3. Keep the MVP local-first and zero-cost using Docker Compose.
4. Use TypeScript across the stack.
5. Use Express for backend HTTP services.
6. Use MongoDB for product data, event data, incidents, vault metadata, and audit logs.
7. Use Redis for hot-path state: cache, rate limits, idempotency, threshold counters, locks, and short-lived worker status.
8. Use RabbitMQ for asynchronous event processing, retries, and dead-letter queues.
9. Use Socket.IO for live dashboard updates.
10. Use k6 for load tests.
11. Prefer real microservice boundaries, but allow selected services to be deployed together during MVP implementation.
12. Every service must have clear ownership, data boundaries, scaling behavior, and failure modes.
13. Every architecture decision must explain tradeoffs and alternatives.
14. Every security-sensitive workflow must define what is stored, what is returned, what is cached, and what must never be logged.

## Security Rules

PulseOps must be planned and implemented with secure defaults:

- Never store raw user passwords.
- Never store raw API keys.
- Never store raw vault integration tokens.
- Never store raw secret values.
- Never log raw secrets, vault passwords, API keys, integration tokens, JWTs, authorization headers, cookies, or database URLs.
- Hash user passwords with Argon2id or bcrypt.
- Hash API keys and integration tokens with a strong keyed hash or slow hash where appropriate.
- Encrypt vault secret values with AES-256-GCM.
- Derive vault encryption keys from a separate vault password using Argon2id or scrypt.
- Store only encrypted value, IV/nonce, auth tag, salt, version, metadata, and audit-safe identifiers.
- Return secret values only from explicit reveal/fetch endpoints after authorization.
- Never return secret values from list endpoints.
- Audit every vault create, reveal, update, delete, token create, token revoke, and token fetch action.
- Redact sensitive fields in all logs, error responses, worker payload logs, and screenshots.

## Architecture Defaults

Use these defaults unless a later architecture document explicitly overrides them:

- Runtime: Node.js LTS.
- Language: TypeScript.
- Backend framework: Express.
- Frontend: Next.js or React with Vite. Prefer Next.js for dashboard routing unless local simplicity wins during implementation.
- Styling: Tailwind CSS.
- Charts: Recharts.
- Realtime: Socket.IO.
- Monorepo: pnpm workspaces.
- Database: MongoDB.
- Cache and ephemeral state: Redis.
- Queue: RabbitMQ.
- Load testing: k6.
- API documentation: OpenAPI-compatible markdown contracts first, generated OpenAPI later.
- Validation: Zod in a shared package.
- Logging: structured JSON logs with redaction.
- Docker: Docker Compose for all local services.

## Planning Standard

The planning pack is not complete unless it clearly answers:

- why each microservice exists
- which service owns which data
- which APIs each service exposes
- which queues each service publishes and consumes
- where Redis is used and why
- how idempotency works
- how duplicates are prevented
- how RabbitMQ retries and dead-letter queues work
- how poison messages are handled
- how incident detection works
- how secrets are encrypted
- how vault integration tokens work
- how audit logs are created
- how the dashboard receives live updates
- how failures are handled
- how tests prove system design behavior
- how the system runs locally at zero cost
- how the project will be demonstrated to recruiters

## Implementation Guardrails

When implementation begins:

- Build vertical slices, not isolated layers.
- Start with one happy path that crosses API gateway, auth/project, ingestion, RabbitMQ, worker, MongoDB, Redis, dashboard API, and WebSocket.
- Use shared packages only for stable contracts, validation, logging, config, and errors.
- Do not put service-specific database models in shared packages.
- Do not let one service write another service's collections.
- Do not introduce Kubernetes, cloud services, paid services, Kafka, Prometheus, or Grafana in the MVP unless explicitly approved.
- Do not add team RBAC, alert delivery, tracing, anomaly detection, or SDK publishing before the MVP is stable.
- Prefer explicit boring reliability over clever abstractions.

## Required Planning Artifacts

The authoritative planning pack is:

- `01_PRODUCT_SCOPE.md`
- `02_ARCHITECTURE_OVERVIEW.md`
- `03_SERVICE_BOUNDARIES.md`
- `04_COMMUNICATION_WORKFLOWS.md`
- `05_DATA_MODEL_AND_OWNERSHIP.md`
- `06_RABBITMQ_QUEUE_DESIGN.md`
- `07_REDIS_STRATEGY.md`
- `08_VAULT_SECURITY_ARCHITECTURE.md`
- `09_INCIDENT_DETECTION.md`
- `10_API_CONTRACTS.md`
- `11_FRONTEND_DASHBOARD_PLAN.md`
- `12_LOCAL_INFRA_DOCKER_COMPOSE_PLAN.md`
- `13_INTERNAL_OBSERVABILITY.md`
- `14_FAILURE_RESILIENCE_PLAN.md`
- `15_TESTING_STRATEGY.md`
- `16_IMPLEMENTATION_ROADMAP.md`
- `17_REPOSITORY_STRUCTURE.md`
- `18_ADR_PACK.md`
- `19_README_RECRUITER_PLAN.md`
- `20_PLANNING_REVIEW.md`
- `21_CODING_BACKLOG.md`
- `22_SECURITY_THREAT_MODEL.md`

## Definition Of Planning Complete

Planning is complete when:

- all required markdown files exist
- all major decisions are explicit
- security-sensitive data flows are threat-modeled
- service ownership is unambiguous
- queue, Redis, and MongoDB behavior is specified
- MVP and later scope are separated
- the build roadmap is vertical-slice-first
- the backlog can be handed to an implementation agent without product decisions left open
- no real credentials or sensitive values appear in the docs
