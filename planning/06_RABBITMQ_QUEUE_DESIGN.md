# PulseOps RabbitMQ Queue Design

## Goals

RabbitMQ is the async backbone for PulseOps. It must demonstrate durable messaging, routing, retries, dead-letter queues, idempotent consumers, worker scaling, and failure recovery.

## Exchanges

| Exchange | Type | Purpose |
| --- | --- | --- |
| `pulseops.telemetry.x` | direct | route accepted logs/errors/metrics |
| `pulseops.incidents.x` | direct | route incident evaluation and incident lifecycle events |
| `pulseops.audit.x` | direct | route sensitive audit events |
| `pulseops.realtime.x` | fanout or topic | route live dashboard updates |
| `pulseops.retry.x` | direct | delayed retry routing using TTL queues |
| `pulseops.dlx` | direct | dead-letter routing |

## Queues And Routing

| Queue | Routing Key | Producer | Consumer | DLQ |
| --- | --- | --- | --- | --- |
| `pulseops.logs.q` | `telemetry.log.v1` | Ingestion | Log worker | `pulseops.dead-letter.q` |
| `pulseops.errors.q` | `telemetry.error.v1` | Ingestion | Error worker | `pulseops.dead-letter.q` |
| `pulseops.metrics.q` | `telemetry.metric.v1` | Ingestion | Metric worker | `pulseops.dead-letter.q` |
| `pulseops.incident-eval.q` | `incident.evaluate.v1` | Event workers | Incident worker | `pulseops.dead-letter.q` |
| `pulseops.audit.q` | `audit.vault.v1` | Vault | Audit worker | `pulseops.dead-letter.q` |
| `pulseops.realtime.q` | `realtime.*.v1` | Workers/services | Realtime gateway | `pulseops.dead-letter.q` |
| `pulseops.retry.10s.q` | retry delay | retry exchange | RabbitMQ TTL | DLX back to source |
| `pulseops.retry.60s.q` | retry delay | retry exchange | RabbitMQ TTL | DLX back to source |
| `pulseops.retry.300s.q` | retry delay | retry exchange | RabbitMQ TTL | DLX back to source |
| `pulseops.dead-letter.q` | `dead.*` | RabbitMQ DLX | Ops tooling | none |

## Message Envelope

All messages use a common envelope:

```json
{
  "messageId": "uuid",
  "schemaVersion": 1,
  "type": "telemetry.error",
  "projectId": "project-id",
  "environment": "production",
  "correlationId": "request-id",
  "causationId": "optional-parent-message-id",
  "occurredAt": "2026-08-18T00:00:00.000Z",
  "publishedAt": "2026-08-18T00:00:01.000Z",
  "attempt": 1,
  "payload": {}
}
```

Rules:

- Payloads must be schema-validated.
- Messages must not include raw API keys, raw integration tokens, raw secret values, vault passwords, JWTs, or authorization headers.
- `messageId` supports consumer idempotency.
- `correlationId` links HTTP request, worker logs, and audit logs.

## Payload Contracts

| Message Type | Required Payload |
| --- | --- |
| `telemetry.log` | `service`, `level`, `message`, `metadata`, `sourceTimestamp` |
| `telemetry.error` | `service`, `message`, `stackHash`, `fingerprint`, `metadata`, `sourceTimestamp` |
| `telemetry.metric` | `service`, `metricName`, `value`, `unit`, `latencyMs`, `metadata`, `sourceTimestamp` |
| `incident.evaluate` | `projectId`, `environment`, `ruleType`, `service`, `fingerprint`, `eventId`, `metricName`, `value` |
| `audit.vault` | `actorType`, `actorId`, `action`, `secretKey`, `tokenPrefix`, `result`, `ipAddress`, `userAgent` |
| `realtime.update` | `projectId`, `environment`, `eventName`, `summary`, `entityId` |

## Retry Strategy

| Attempt | Delay | Behavior |
| --- | --- | --- |
| 1 | none | initial consume |
| 2 | 10 seconds | transient failure retry |
| 3 | 60 seconds | slower retry |
| 4 | 300 seconds | final retry |
| after 4 | none | publish to DLQ |

Retryable failures:

- MongoDB temporarily unavailable.
- Redis temporarily unavailable where fallback is not safe.
- transient network errors.
- RabbitMQ publish failure for required follow-up messages.

Non-retryable failures:

- invalid schema version.
- permanently malformed payload.
- unauthorized project id in message.
- payload contains blocked sensitive fields after redaction failure.

## Dead-Letter Payload Metadata

DLQ messages include:

- original exchange and routing key
- original message id
- final attempt count
- failure category
- redacted failure reason
- first failure time
- last failure time
- redacted payload summary

DLQ messages must not include raw secrets or credentials.

## Consumer Idempotency

Consumers must use `messageId` and domain-specific natural keys:

- event workers: prevent duplicate event write by `messageId` or `ingestionId`
- incident worker: dedupe open incidents by project/environment/rule/fingerprint/service
- audit worker: dedupe by `messageId` where possible

Redis can hold short idempotency state, but MongoDB unique indexes protect durable writes.

## Acknowledgement Rules

- Use manual ack.
- Ack only after required durable writes succeed.
- Nack retryable failures into retry flow.
- Reject non-retryable poison messages to DLQ.
- Use bounded prefetch, starting at 10 per worker instance for MVP.

## Backpressure

- Ingestion returns `202` only after confirm publish.
- If RabbitMQ publish latency or queue depth is too high, Ingestion can return `503` or stricter `429`.
- Workers expose queue lag and processing rates.
- Dashboard shows queue depth and DLQ count.

## Crash Behavior

- Worker crash before ack causes RabbitMQ redelivery.
- Worker crash after MongoDB write but before ack can duplicate delivery; idempotent writes prevent duplicate records.
- RabbitMQ down prevents accepting new ingestion.
- MongoDB down causes retries and eventually DLQ.
- Redis down degrades rate limiting and counters; ingestion should fail closed for rate limiting unless a documented emergency bypass is enabled for local demo.
