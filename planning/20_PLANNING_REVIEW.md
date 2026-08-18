# PulseOps Planning Completeness Review

## Critical Gaps Checked

| Area | Status | Notes |
| --- | --- | --- |
| Product scope | Approved | MVP, V1.5, and V2 separated |
| Microservice boundaries | Approved | logical ownership and separate runtime deployment defined |
| Data ownership | Approved | every collection has owner |
| Redis strategy | Approved | cache, rate limits, idempotency, counters, locks defined |
| RabbitMQ strategy | Approved | exchanges, queues, retries, DLQ, ack rules defined |
| Vault security | Approved | encryption, KDF, token hashing, audit, no raw secrets |
| Incident detection | Approved | repeated error and latency rules defined |
| API contracts | Approved | endpoints, auth, failures, rate limits specified |
| Frontend states | Approved | loading, empty, error, realtime reconnect covered |
| Local infrastructure | Approved | Docker Compose components planned |
| Testing | Approved | system design behaviors included |
| Recruiter demo | Approved | clear demo path and screenshot checklist |

## High-Priority Fixes For Implementation

- Enforce redaction before any logger is used in request handlers or workers.
- Add MongoDB unique indexes before running worker tests.
- Require RabbitMQ confirm publish before ingestion returns `202`.
- Implement API key cache invalidation on rotation and disable.
- Keep vault reveal using POST, not GET, to avoid sensitive data in URL logs.
- Ensure audit publish succeeds before sensitive vault operations complete.
- Make idempotency durable enough that worker redelivery cannot duplicate event records.

## Things To Simplify

- Keep each runtime separately deployable even during the first vertical slice.
- Start only the subset of services needed for a slice, rather than merging runtimes.
- Use one `events` collection with type discriminator in MVP.
- Use manual dashboard refresh plus Socket.IO updates before adding complex realtime replay.
- Keep incident resolution manual in MVP.

## Things To Keep Because They Impress Recruiters

- RabbitMQ retry and DLQ behavior.
- Redis rate limiting and idempotency.
- Time-window incident detection.
- Worker health and queue dashboard.
- Vault encryption and token hashing.
- Audit logs for sensitive operations.
- k6 tests that visibly trigger incidents.
- ADR pack and failure scenario documentation.

## Approved MVP Plan

Build a TypeScript Express pnpm monorepo with local Docker Compose infrastructure. Deliver a vertical slice from project/API key creation to telemetry ingestion, RabbitMQ processing, MongoDB persistence, Redis hot-path behavior, incident detection, live dashboard updates, vault secret encryption, integration token fetch, audit logs, and k6 load testing.

## Ready To Start Implementation

Yes. The planning pack is sufficient to begin implementation once the user explicitly requests code.

## Implementation Warnings

- Do not overbuild service deployment before the vertical slice works.
- Do not add RBAC, alert integrations, or SDK publishing before README polish.
- Do not let raw telemetry metadata become a secret leakage path.
- Do not log request bodies on vault or auth routes.
- Do not treat Redis as durable source of truth.
- Do not return success for ingestion when RabbitMQ publish failed.
