# PulseOps Failure And Resilience Plan

## Principles

- Acknowledge accepted ingestion only after RabbitMQ confirm publish.
- Workers ack only after required durable writes and follow-up publishes.
- Prefer fail-closed for security and admission control.
- Show degraded state clearly in dashboard.
- Never hide dependency failure behind fake success.

## Failure Matrix

| Failure | User Impact | Data Loss Risk | Recovery | Dashboard Signal |
| --- | --- | --- | --- | --- |
| RabbitMQ down | ingestion returns `503`; workers idle | no accepted event loss if publish confirm required | reconnect publisher/consumers | queue status degraded |
| MongoDB down | writes fail; dashboard reads fail or stale | none for unacked messages; possible stale dashboard | worker retries then DLQ | DB unhealthy, queue depth rising |
| Redis down | rate limit/idempotency/cache degraded | duplicate risk if idempotency bypassed | reconnect; fallback where safe | cache degraded, rate limit degraded |
| Worker crash mid-message | processing pauses | low; unacked message redelivered | restart worker, idempotent consume | worker stale heartbeat |
| Ingestion burst exceeds limit | clients get `429` | none | retry after window | rate-limit hit counter |
| Duplicate event arrives | duplicate accepted only if no idempotency | low if worker idempotency works | idempotent response or dedupe write | duplicate count metric |
| Poison message | message retries then DLQ | isolated bad message only | inspect/replay after fix | DLQ count > 0 |
| Invalid API key | request rejected | none | generate valid key | auth rejection metric |
| Expired vault token | fetch rejected | none | rotate/create token | vault audit failure |
| Wrong vault password | reveal rejected | none | retry manually | vault audit failure |
| Missing secret | fetch returns `404` | none | create secret or fix key | audit failure |
| WebSocket disconnect | live updates pause | none | reconnect and refetch summary | stale connection indicator |

## RabbitMQ Down

Behavior:

- Ingestion health is degraded.
- New ingestion requests return `503`.
- Existing queued messages are unavailable until broker returns.
- API gateway remains available for dashboard and vault where dependencies allow.

Logged:

- broker connection failure
- publish failure
- request id and project id, no API key

## MongoDB Down

Behavior:

- Auth and dashboard reads fail with `503` unless cached data is acceptable.
- Workers retry events because durable persistence is unavailable.
- Vault operations fail closed because encrypted secret source of truth is unavailable.

Recovery:

- Workers resume when MongoDB returns.
- Messages that exceeded retry count land in DLQ.

## Redis Down

Behavior:

- API key validation can fallback to MongoDB.
- Rate limiting fails closed by default.
- Dashboard summaries bypass cache.
- Incident counters degrade; avoid noisy incident creation.
- Vault token validation falls back to MongoDB.

Risk:

- If idempotency is unavailable and requests are accepted, duplicate processing risk rises. MVP should return `503` for idempotent ingestion when Redis is required.

## Worker Crash

Behavior:

- RabbitMQ redelivers unacked message.
- MongoDB unique indexes and idempotency prevent duplicate durable writes.
- Heartbeat expires in Redis and dashboard marks worker stale.

## Poison Message

Detection:

- schema validation fails repeatedly, or processing fails with same permanent error.

Behavior:

- do not retry forever.
- send to DLQ with redacted failure metadata.
- dashboard shows DLQ count and latest redacted reason.

## Vault-Specific Resilience

- Wrong vault password never reveals whether decryption metadata is valid beyond generic failure.
- Audit publish failure blocks secret reveal/create/update/delete.
- Integration token cache miss falls back to MongoDB.
- Expired/revoked token cache invalidates immediately when changed through dashboard.

## WebSocket Recovery

Client behavior:

- display disconnected state.
- attempt reconnect.
- on reconnect, rejoin project/environment room.
- refetch summary and latest page to cover missed events.

Server behavior:

- do not store live-only data as source of truth.
- emit updates only after durable write.
