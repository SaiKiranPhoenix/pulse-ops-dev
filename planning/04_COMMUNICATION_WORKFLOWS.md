# PulseOps Communication Workflows

## Communication Rules

- Use HTTP for user-driven commands and dashboard queries.
- Use RabbitMQ for telemetry processing, incident evaluation, audit writes, retries, and DLQs.
- Use Redis for hot path cache, counters, idempotency, rate limits, short locks, and short-lived health.
- Use MongoDB for durable source-of-truth state.
- Use Socket.IO for live dashboard updates after durable writes succeed.

## Workflow Matrix

| Workflow | Actor | Path | Redis | MongoDB | Failure Behavior |
| --- | --- | --- | --- | --- | --- |
| User login | Browser | Gateway -> Auth/Project | optional session denylist later | read `users` | invalid credentials return `401`; no credential detail in logs |
| Project creation | Browser | Gateway -> Auth/Project | invalidate project list cache if added | write `projects` | duplicate name allowed per user only if planned; otherwise `409` |
| API key generation | Browser | Gateway -> Auth/Project | delete old `apiKey:*` cache if rotating | write `apiKeys` hash | raw key returned once only |
| Log ingestion | Client app | Ingestion -> Redis -> RabbitMQ `logs.q` | API key cache, rate, idempotency | none on request path | RabbitMQ down returns `503`; rate exceeded returns `429` |
| Error ingestion | Client app | Ingestion -> Redis -> RabbitMQ `errors.q` | same as logs | none on request path | duplicate idempotency key returns previous acceptance response |
| Metric ingestion | Client app | Ingestion -> Redis -> RabbitMQ `metrics.q` | same as logs | none on request path | malformed metric returns `400` |
| Event processing | Worker | RabbitMQ -> Worker -> MongoDB -> Redis -> Realtime | hot metrics, dashboard invalidation | write `events` | worker crash requeues unacked message |
| Incident creation | Incident worker | `incident-eval.q` -> Redis counters -> MongoDB | time-window counters, dedupe lock | upsert `incidents` | existing open incident is updated, not duplicated |
| Dashboard summary | Browser | Gateway -> Dashboard Query | cache-aside summary | read events/incidents/workers | stale cache acceptable for 15-30 seconds |
| Live dashboard update | Worker/service | durable write -> Realtime Gateway -> Socket.IO room | optional pub/sub adapter | source write already complete | disconnect triggers client HTTP refresh |
| Vault secret creation | Browser | Gateway -> Vault -> Audit queue | no raw secret cache | write encrypted `secrets` | failed audit publish blocks operation |
| Vault secret reveal | Browser | Gateway -> Vault -> Audit queue | no raw secret cache | read encrypted secret | wrong password returns `401`; audit failure blocks reveal |
| External secret fetch | App | Vault integration API -> token validation -> decrypt | token validation cache only | read `vaultTokens`, `secrets` | expired token returns `401`; missing secret returns `404` |
| Audit log creation | Vault/service | RabbitMQ `audit.q` -> Audit worker | optional recent audit list cache invalidation | write `vaultAuditLogs` | retry then DLQ; critical vault actions require publish ack |

## Detailed Ingestion Flow

1. Client sends telemetry to `/api/ingest/{logs|errors|metrics}`.
2. Ingestion hashes the API key and looks up `apiKey:{hash}` in Redis.
3. On cache miss, Ingestion calls Auth/Project or reads an allowed API key validation view, then caches project id, owner id, environment permissions, and status.
4. Ingestion increments `rate:{projectId}:{minute}` with TTL and rejects when the threshold is exceeded.
5. If `idempotency-key` exists, Ingestion attempts `SET NX idem:{projectId}:{key}` with TTL.
6. Ingestion publishes a versioned message to the correct RabbitMQ routing key.
7. Ingestion returns `202 Accepted` after RabbitMQ confirms publish.

## Detailed Worker Flow

1. Worker consumes with manual ack and bounded prefetch.
2. Worker validates message contract and schema version.
3. Worker normalizes timestamp, service name, environment, metadata, and fingerprint where needed.
4. Worker writes durable event to MongoDB.
5. Worker updates Redis hot counters and invalidates dashboard summary cache.
6. Worker publishes incident evaluation message where relevant.
7. Worker emits realtime update or publishes a realtime event.
8. Worker acknowledges only after durable write and required publishes succeed.

## Detailed Vault Flow

1. User sends secret create/reveal request over authenticated dashboard API.
2. Vault verifies project ownership through JWT claims and project ownership check.
3. Vault derives an encryption key from vault password and per-secret/project salt.
4. For create/update, Vault encrypts with AES-256-GCM and stores encrypted fields only.
5. For reveal, Vault decrypts only in memory and returns the value in the response body.
6. Vault publishes audit message and never includes raw secret value or vault password.
7. Vault redacts all sensitive request fields before logs.

## Retry Behavior

- HTTP commands are not automatically retried server-side unless idempotency is defined.
- RabbitMQ consumers retry transient failures with exponential backoff.
- Poison messages go to DLQ with failure reason, attempt count, and redacted payload metadata.
- Dashboard reads can be retried by the browser.
- Vault reveal should not be retried automatically by the server after wrong password.
