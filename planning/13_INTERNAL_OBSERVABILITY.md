# PulseOps Internal Observability

## Goal

PulseOps monitors external applications, but the MVP must also expose enough visibility into PulseOps itself to demonstrate operational maturity.

## What To Capture

| Signal | Source | Where Visible |
| --- | --- | --- |
| API request logs | API gateway middleware | terminal logs, README screenshots |
| request latency | API gateway | health summary, logs |
| ingestion accepted/rejected counts | ingestion service | dashboard overview, load test output |
| rate limit hits | ingestion service | logs, dashboard metric |
| queue depth | RabbitMQ | workers/queues screen |
| worker processed/failed count | workers | worker health screen |
| worker heartbeat | workers | worker health screen and Redis |
| DLQ count | RabbitMQ/Ops | workers/queues screen |
| cache hit/miss | Redis wrappers | logs and dashboard summary |
| incident rule triggers | incident worker | incidents screen, logs |
| vault audit volume | audit worker | vault audit screen |

## Logging Standard

Use structured JSON logs:

- `timestamp`
- `level`
- `service`
- `requestId`
- `correlationId`
- `message`
- `metadata`

Redaction required for:

- passwords
- vault passwords
- secret values
- API keys
- integration tokens
- JWTs
- authorization headers
- cookies
- database URLs

## Health Endpoints

`GET /api/health`:

- service status
- version
- uptime
- MongoDB status
- Redis status
- RabbitMQ status
- current timestamp

`GET /api/admin/workers`:

- worker name
- type
- status
- last heartbeat
- processed count
- failed count
- current queue

`GET /api/admin/queues`:

- queue name
- ready messages
- unacked messages
- consumers
- publish rate if available
- DLQ count

## Dashboard Requirements

Workers/Queues screen should show:

- all worker statuses
- stale heartbeat warning
- queue depth
- unacked count
- DLQ count
- latest failed job summary with redacted reason

Overview screen should show:

- events accepted today
- events processed today
- ingestion rejection count
- active incidents
- queue status badge
- worker health badge

## Load Test Evidence

k6 output should be paired with:

- API accepted/rejected counts
- RabbitMQ queue depth before/during/after
- worker processed counts
- incident created count
- rate limit hit count

## MVP Metrics Without Prometheus

Use Redis counters and service logs for MVP:

- `internal:ingest:accepted:{minute}`
- `internal:ingest:rejected:{reason}:{minute}`
- `internal:worker:processed:{worker}:{minute}`
- `internal:worker:failed:{worker}:{minute}`
- `internal:cache:{name}:hits:{minute}`
- `internal:cache:{name}:misses:{minute}`

Prometheus/Grafana are Version 2.

## README Screenshot Checklist

Capture:

- dashboard overview with live KPIs
- RabbitMQ management UI showing queues
- workers/queues screen with active workers
- incident screen after k6 trigger
- vault audit screen after reveal/fetch
- load test terminal summary
