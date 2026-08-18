# PulseOps Testing Strategy

## Testing Goal

Tests must prove system design behavior, not only controller success cases. The minimum showcase suite should demonstrate auth, ingestion, queue processing, Redis behavior, vault security, incident detection, realtime updates, and load behavior.

## Test Categories

| Category | What To Test | Tools | MVP |
| --- | --- | --- | --- |
| Unit | validators, fingerprinting, redaction, KDF wrappers, p95 calculation | Vitest/Jest | yes |
| API integration | auth, projects, ingestion, dashboard, vault | Supertest, testcontainers optional | yes |
| Queue | publish, consume, retry, DLQ, ack behavior | RabbitMQ test container or local compose | yes |
| Redis | rate limits, idempotency, cache TTL, counters | Redis test container or local compose | yes |
| MongoDB | indexes, unique constraints, retention assumptions | mongodb-memory-server or test container | yes |
| Vault encryption | AES-GCM decrypt success/failure, wrong password, token hashing | Vitest/Jest | yes |
| Incident rules | repeated error, high latency, dedupe, manual resolve | unit + integration | yes |
| Worker | idempotent writes, retryable failures, poison messages | integration | yes |
| Realtime | room authorization, event emission after writes, reconnect refresh | Socket.IO client tests | yes |
| Load | throughput, burst, rate limits, incident trigger | k6 | yes |
| Failure | dependency down behavior | compose profiles/manual scripts | partial MVP |

## Minimum Test Set Before GitHub Showcase

- Register, login, and access protected route.
- Create project and generate API key; raw key returned once.
- Ingest log returns `202` and worker persists event.
- Invalid API key returns `401`.
- Rate limit returns `429`.
- Duplicate `idempotency-key` does not create duplicate event.
- Error threshold creates one incident.
- Repeated threshold crossing updates existing open incident instead of duplicating.
- High latency metrics create one incident.
- Dashboard summary returns counts from cache-aside path.
- WebSocket receives event and incident updates.
- Secret create stores encrypted value only.
- Secret list does not return value.
- Reveal with wrong vault password fails.
- Reveal with correct vault password succeeds and writes audit log.
- Integration token fetch works, expired token fails.
- RabbitMQ worker retry sends poison message to DLQ.
- k6 burst shows accepted events and queue drain.

## Example Unit Tests

- `fingerprintError()` produces same fingerprint for dynamic IDs.
- `redactSensitiveFields()` removes `password`, `token`, `authorization`, `secret`, `DATABASE_URL`.
- `calculateP95()` handles small sample sizes and sorted/unsorted input.
- vault encryption cannot decrypt with wrong password or tampered auth tag.

## Example Integration Tests

- API key validation reads MongoDB on cache miss and Redis on second request.
- API key rotation invalidates old Redis cache.
- Worker writes event, updates Redis hot counter, publishes incident evaluation.
- Audit worker persists vault audit event without raw sensitive fields.

## k6 Scenarios

| Script | Purpose | Expected |
| --- | --- | --- |
| `normal-traffic.js` | mixed telemetry | mostly `202`, no DLQ |
| `burst-traffic.js` | queue backpressure visibility | queue depth rises then drains |
| `rate-limit.js` | admission control | predictable `429` |
| `repeated-errors.js` | incident rule | repeated error incident created |
| `high-latency.js` | latency rule | high latency incident created |

## Acceptance Criteria

- Tests run from documented commands.
- Failure tests do not require paid services.
- Test fixtures use fake secrets only.
- Logs generated during tests do not expose sensitive values.
- Load tests produce evidence useful for README.
