# PulseOps Service Boundaries

## Boundary Principles

- Split by ownership of business capability, not by CRUD tables.
- Each service owns its writes and validates its own invariants.
- Shared packages contain contracts and utilities, not service database models.
- Queue payloads are versioned contracts.
- MVP runtime grouping is allowed only when logical boundaries remain intact.

## Services

| Service | Responsibility | Owns | Must Not Own |
| --- | --- | --- | --- |
| API Gateway | Public HTTP edge, auth middleware, request logging, route composition | routing policy, redaction, correlation IDs | business data, queue processing, encryption keys |
| Auth/Project | user identity, JWTs, project ownership, API key lifecycle | `users`, `projects`, `apiKeys` | telemetry events, vault secrets, incident rules |
| Ingestion | telemetry acceptance, API key validation, rate limiting, idempotent publish | ingestion validation, request admission records | long processing, dashboard queries, incident persistence |
| Event Workers | normalize and persist logs/errors/metrics | `events`, worker processing stats | user auth, vault secrets, frontend session state |
| Incident | rule evaluation, incident dedupe, status lifecycle | `incidents`, incident rule config | raw secret values, API keys, user passwords |
| Dashboard Query | read-optimized summaries and lists | dashboard cache policy, read models if added | source-of-truth writes owned by domain services |
| Realtime Gateway | project-scoped Socket.IO rooms and live events | socket sessions, project room subscriptions | persistent telemetry or vault data |
| Vault | encrypted secrets, vault tokens, reveal/fetch flows | `secrets`, `vaultTokens`, vault cryptographic metadata | auth passwords, telemetry processing |
| Audit | durable sensitive operation logs | `vaultAuditLogs`, future audit records | raw sensitive payloads, modifying vault data |
| Ops/Worker Health | service health, worker heartbeat, queue status snapshots | `workerHealth`, queue status snapshots | telemetry event source of truth |

## Collections By Owner

| Collection | Owner |
| --- | --- |
| `users` | Auth/Project |
| `projects` | Auth/Project |
| `apiKeys` | Auth/Project |
| `events` | Event Workers |
| `incidents` | Incident |
| `workerHealth` | Ops/Worker Health |
| `secrets` | Vault |
| `vaultTokens` | Vault |
| `vaultAuditLogs` | Audit |
| `idempotencyRecords` | Ingestion, only when durability beyond Redis is required |

## Redis Ownership

| Key Family | Main User |
| --- | --- |
| `apiKey:{keyHash}` | Ingestion, Auth/Project invalidates |
| `rate:{projectId}:{window}` | Ingestion |
| `idem:{projectId}:{idempotencyKey}` | Ingestion |
| `dashboard:{projectId}:{env}:summary` | Dashboard Query |
| `metrics:{projectId}:{env}:hot` | Event Workers and Dashboard Query |
| `error:{projectId}:{env}:{fingerprint}` | Event Workers and Incident |
| `incident:{projectId}:{env}:{rule}:{bucket}` | Incident |
| `vaultToken:{tokenHash}` | Vault |
| `worker:{workerName}:heartbeat` | Ops/Worker Health |

## Queue Ownership

| Queue | Producer | Consumer |
| --- | --- | --- |
| `pulseops.logs.q` | Ingestion | Log worker |
| `pulseops.errors.q` | Ingestion | Error worker |
| `pulseops.metrics.q` | Ingestion | Metric worker |
| `pulseops.incident-eval.q` | Event workers | Incident worker |
| `pulseops.audit.q` | Vault and sensitive services | Audit worker |
| `pulseops.realtime.q` | Workers, Incident, Audit | Realtime gateway, optional for MVP |
| `pulseops.dead-letter.q` | RabbitMQ DLX | Ops/admin inspection |

## Sync APIs Exposed

| Service | APIs |
| --- | --- |
| Auth/Project | `/api/auth/*`, `/api/projects/*` |
| Ingestion | `/api/ingest/logs`, `/api/ingest/errors`, `/api/ingest/metrics` |
| Dashboard Query | `/api/dashboard/:projectId/*` |
| Incident | `/api/incidents/:projectId`, `/api/incidents/:incidentId/*` |
| Vault | `/api/vault/:projectId/*`, `/api/v1/secrets*` |
| Ops | `/api/health`, `/api/admin/workers`, `/api/admin/queues` |

## Scaling Strategy

- Ingestion scales horizontally because it is stateless apart from Redis/RabbitMQ dependencies.
- Workers scale by queue consumer count and prefetch settings.
- Dashboard Query scales with Redis cache-aside and read-only MongoDB indexes.
- Realtime Gateway scales with project rooms and a Redis adapter if multiple instances are used.
- Vault scales conservatively; crypto cost and audit logging are intentional bottlenecks for sensitive operations.

## Failure Modes By Service

| Service | Failure Mode | Expected Behavior |
| --- | --- | --- |
| API Gateway | downstream unavailable | return `503` with correlation ID and no sensitive details |
| Auth/Project | Redis unavailable | fall back to MongoDB for API key validation where safe |
| Ingestion | RabbitMQ unavailable | reject ingestion with `503`; do not pretend event was accepted |
| Event Workers | MongoDB down | retry message, then DLQ after max attempts |
| Incident | Redis down | skip automatic incident creation or use degraded Mongo aggregation for low volume |
| Dashboard Query | cache miss | read from MongoDB and repopulate cache |
| Realtime Gateway | socket disconnect | client reconnects and refreshes summary via HTTP |
| Vault | wrong password | reject reveal/fetch, audit failed attempt without secret value |
| Audit | queue lag | sensitive operation continues only if audit publish succeeds for critical vault actions |
| Ops | RabbitMQ management unavailable | show degraded queue status |

## MVP Merge Candidates

Can be merged initially:

- API Gateway + Auth/Project + Dashboard Query + Incident HTTP API.
- Event Workers + Incident Worker + Ops heartbeat.
- Audit worker can be part of worker runtime if it keeps separate queue and collection logic.

Must remain separate logically:

- Vault security logic from ingestion/event processing.
- Ingestion admission path from heavy event processing.
- RabbitMQ workers from HTTP request handling.
