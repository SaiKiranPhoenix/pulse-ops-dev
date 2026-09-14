# PulseOps Product Scope

## Product Vision

PulseOps is a local-first developer operations platform for monitoring application behavior, detecting incidents, and managing encrypted environment secrets. The MVP should prove that a single developer can build and operate a serious microservices-style system with real queues, caches, workers, security controls, and live dashboards.

## Target Users

- Backend developers who need visibility into logs, errors, latency, and worker health.
- DevOps/SRE learners who want a realistic incident detection project.
- Small engineering teams that need project-level secrets and audit trails.
- Recruiters and interviewers evaluating backend depth, system design judgment, and implementation discipline.

## MVP User Stories

- As a user, I can register, log in, and manage my own projects.
- As a project owner, I can generate, rotate, disable, and use API keys for ingestion.
- As an application, I can send logs, errors, and metrics to PulseOps with an API key.
- As the system, PulseOps accepts ingestion quickly, publishes to RabbitMQ, and processes events asynchronously.
- As a dashboard user, I can see recent logs, errors, metrics, incidents, queue health, and worker health.
- As a dashboard user, I see new events and incidents appear live without refresh.
- As a user, I can store encrypted secrets per project and environment.
- As a user, I can reveal a secret only after providing the vault password.
- As an external app, I can fetch allowed secrets using a vault integration token.
- As an auditor, I can inspect vault-sensitive actions without seeing raw secret values.
- As a reviewer, I can run k6 tests that demonstrate high-volume ingestion and rate limiting.

## MVP Feature List

- Auth with JWT sessions and protected dashboard routes.
- Project ownership and environment selection: `development`, `staging`, `production`.
- API key generation, hashing, rotation, disabling, and Redis-backed validation cache.
- Ingestion endpoints for logs, errors, and metrics.
- Redis-backed per-project rate limiting and idempotency.
- RabbitMQ exchanges, queues, retries, and dead-letter queues.
- Workers for log, error, metric, incident, audit, and worker heartbeat behavior.
- MongoDB collections for users, projects, API keys, events, incidents, worker health, secrets, vault tokens, audit logs, and idempotency records where Redis durability is insufficient.
- Automatic incidents for repeated errors and high latency.
- Dashboard summary, event list, incident list, worker/queue health, and vault activity.
- Socket.IO realtime updates for events, incidents, worker status, queue status, and audit entries.
- PulseOps Vault with AES-256-GCM secret encryption and Argon2id or scrypt key derivation.
- k6 scripts for normal traffic, burst traffic, repeated errors, high latency, and rate-limit scenarios.
- README and screenshots/GIF checklist targeted at recruiters.

## Version 1.5

- DLQ replay tool from the admin dashboard.
- Queue backlog incident rule.
- Secret token scopes beyond read-only project/environment access.
- Secret rotation history without rollback.
- Better filtering and saved dashboard views.
- More detailed worker throughput charts.
- Bruno/Postman collection committed with example workflows.

## Version 2

- Role-based team access.
- Email, webhook, Slack, or Teams alerts.
- Uptime checks.
- SDK package for Node.js applications.
- Trace/span correlation.
- Secret version rollback and expiration policies.
- Advanced anomaly detection.
- Prometheus/Grafana integration as optional observability for PulseOps itself.
- Multi-tenant organization model.
- Cloud deployment option after local MVP is complete.

## Non-Goals

- No Kubernetes for MVP.
- No paid cloud dependency.
- No real payment, billing, or subscription flow.
- No production-grade HashiCorp Vault replacement claim.
- No full SIEM, APM, or distributed tracing product.
- No team RBAC in MVP.
- No alert delivery in MVP beyond dashboard incidents.
- No SDK publishing before the core ingestion API is stable.

## Recruiter And Interview Value

- Shows async architecture with RabbitMQ and workers.
- Shows hot-path design with Redis caching, rate limiting, idempotency, and counters.
- Shows security awareness through encrypted secrets, hashed tokens, audit logs, and redaction.
- Shows operational thinking with worker health, queue depth, retries, DLQs, and failure scenarios.
- Shows frontend product polish through live dashboards and clear demo workflows.
- Shows performance awareness through k6 load tests and queue-based ingestion.

## Final Definition Of Done

- Docker Compose starts frontend, backend services, MongoDB, Redis, RabbitMQ, and workers.
- A user can create a project and generate an ingestion API key.
- External events enter through ingestion APIs and are processed asynchronously.
- Redis rate limiting, API key cache, idempotency, and incident counters work.
- Automatic incidents are created from repeated errors and high latency.
- Dashboard shows live events, metrics, incidents, workers, queues, and vault audit activity.
- Vault secrets are encrypted at rest and never shown in list responses.
- Integration tokens fetch allowed secrets and produce audit logs.
- k6 tests demonstrate throughput, rate limits, and incident triggers.
- README explains architecture, security, failure handling, and demo path.

## Temporary Assumptions

- Single-user project ownership in MVP; no organizations or teams.
- API gateway, auth/project, ingestion, workers, incident, realtime, vault, audit, and ops runtimes are deployed separately from the start.
- RabbitMQ is required for ingestion processing and cannot be mocked in the final MVP.
- Redis is required for rate limiting and idempotency and cannot be replaced with in-memory state.
