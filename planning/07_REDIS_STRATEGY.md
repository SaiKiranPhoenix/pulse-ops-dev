# PulseOps Redis Strategy

## Redis Purpose

Redis is used only where low latency, atomic counters, short TTLs, or ephemeral coordination are materially better than MongoDB. It is not the source of truth for durable product state.

## Key Plan

| Use Case | Key Pattern | Value Shape | TTL | Owner |
| --- | --- | --- | --- | --- |
| API key cache | `apiKey:{keyHash}` | project id, status, scopes, envs | 10 min | Ingestion |
| Rate limit | `rate:{projectId}:{env}:{epochMinute}` | integer counter | 70 sec | Ingestion |
| Idempotency | `idem:{projectId}:{idempotencyKey}` | accepted response summary | 24 hours | Ingestion |
| Dashboard summary | `dashboard:{projectId}:{env}:summary` | JSON summary | 15-30 sec | Dashboard Query |
| Recent metrics | `metrics:{projectId}:{env}:hot` | sorted/hash counters | 5 min | Event Workers |
| Error dedupe | `error:{projectId}:{env}:{fingerprint}` | count and last event ids | 5 min | Error Worker |
| Incident counters | `incident:{projectId}:{env}:{rule}:{bucket}` | integer/window stats | window + 60 sec | Incident |
| Incident lock | `lock:incident:{projectId}:{env}:{rule}:{fingerprint}` | lock token | 30 sec | Incident |
| Vault token cache | `vaultToken:{tokenHash}` | project id, env, scopes, status | 5 min | Vault |
| Worker heartbeat | `worker:{workerName}:heartbeat` | status JSON | 30 sec | Ops |

## API Key Cache Flow

1. Hash incoming API key.
2. Read `apiKey:{keyHash}`.
3. On miss, validate against API key source of truth.
4. Cache only non-sensitive authorization metadata.
5. On key disable/rotation, delete the cache key.

Stale risk:

- A disabled key may work until TTL if invalidation fails. Keep TTL short and delete on lifecycle change.

## Rate Limiting Flow

Default MVP limit:

- 600 events per project per environment per minute for normal demo.
- separate lower limit for repeated abuse tests if needed.

Algorithm:

- Use atomic increment on `rate:{projectId}:{env}:{epochMinute}`.
- Set expiry when key is first created.
- Reject when counter exceeds threshold.
- Return `429` with retry-after seconds.

Failure fallback:

- Fail closed for production-like behavior.
- In local demo, allow a documented `RATE_LIMIT_DEGRADED_ALLOW=false` default that must remain false unless explicitly changed.

## Idempotency Flow

1. If request has no `idempotency-key`, process normally.
2. If present, use `SET NX idem:{projectId}:{key}` with a pending marker.
3. After RabbitMQ confirm publish, update value to accepted response summary.
4. Duplicate key returns the previous accepted response if available.
5. If pending marker is stale, allow safe recovery after TTL or explicit timeout handling.

Risk:

- Redis loss can allow duplicate ingestion. Downstream worker idempotency and MongoDB unique indexes must still protect durable writes.

## Dashboard Cache-Aside Flow

1. Dashboard Query reads `dashboard:{projectId}:{env}:summary`.
2. On miss, query MongoDB indexes and Redis hot counters.
3. Store compact summary for 15-30 seconds.
4. Event workers delete or refresh the summary key after meaningful writes.

Stale risk:

- Counts may lag by seconds. This is acceptable for MVP if live events still appear.

## Error Fingerprint Deduplication

Use:

- `error:{projectId}:{env}:{fingerprint}` count with TTL.
- bounded list/set of recent event ids for incident context.

Flow:

1. Error worker computes fingerprint.
2. Increment count and add event id.
3. If count crosses threshold, publish `incident.evaluate`.
4. TTL naturally clears old windows.

## Incident Threshold Counters

Repeated error:

- bucket key by five-minute window.
- threshold: 20 occurrences in 5 minutes.

High latency:

- maintain short sorted samples or bucketed latency values.
- threshold: p95 greater than 1000 ms over 5 minutes with minimum sample count.

MVP simplification:

- p95 can be calculated in worker memory per bucket and backed by Redis sorted sets for demo scale.

## Vault Token Cache

Cache only:

- token hash
- project id
- environment
- scopes
- status
- expiry

Never cache:

- raw token
- decrypted secret values
- vault password
- derived encryption key

Invalidation:

- delete cache on token revoke or expiry-sensitive update.

## Redis Down Behavior

| Feature | Behavior |
| --- | --- |
| API key validation | fallback to MongoDB if available |
| Rate limiting | fail closed by default |
| Idempotency | reject idempotent requests with `503` or accept only if downstream dedupe is clearly safe |
| Dashboard summary | bypass cache and read MongoDB |
| Incident counters | degrade and skip automatic incident creation rather than create noisy incidents |
| Vault token validation | fallback to MongoDB token hash lookup |
| Secret values | unaffected because raw values are never cached |
