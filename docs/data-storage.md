# Data Model And Storage

PulseOps keeps durable product state in MongoDB. Each service owns the indexes for the collections it writes, and the API gateway repeats the read-model indexes it depends on so dashboard query regressions are visible during schema review.

## Retention

Telemetry events are retained for 30 days through the `ttl_events_received_at_30_days` MongoDB TTL index on `ingested_events.receivedAt`.

This retention target applies to raw telemetry. Incidents, vault metadata, API keys, projects, users, and audit events are not TTL-pruned because they are product records.

## Query Indexes

Telemetry dashboard queries are covered by:

- `idx_events_project_received_cursor`
- `idx_events_project_type_received`
- `idx_events_project_env_type_received`
- `idx_events_project_fingerprint_received`
- `idx_events_project_trace_span_time`
- `ttl_events_received_at_30_days`

Incident dashboard and correlation queries are covered by:

- `idx_incidents_project_status_last_seen`
- `idx_incidents_project_last_seen`
- `idx_incidents_project_fingerprint_last_seen`
- `idx_incidents_project_sample_event`
- `uniq_incidents_open_project_fingerprint`

Audit queries are covered by:

- `idx_audit_events_project_occurred`
- `idx_audit_events_project_env_occurred`
- `idx_audit_events_project_action_result_occurred`
- `idx_audit_events_project_actor_occurred`
- `idx_audit_events_project_secret_occurred`

Ingestion acceptance dashboard counters are covered by:

- `idx_ingestion_acceptances_project_created`
- `uniq_ingestion_acceptances_project_idempotency`

## Local Data

Seed a running local stack with a demo user, project, API key, telemetry, an incident-producing error stream, and vault records:

```powershell
pnpm.cmd db:seed
```

Reset local Compose data safely:

```powershell
pnpm.cmd db:reset
```

Use `--yes` to skip the confirmation prompt, `--start` to restart the full app stack after reset, and `--seed` to restart and seed immediately:

```powershell
pnpm.cmd db:reset -- --yes --seed
```

The reset script verifies it is running from the `pulse-ops` repository root and delegates deletion to Docker Compose for this project only.

## Migration Strategy

MongoDB indexes live beside the service-owned Mongoose models and are verified by schema-level unit tests. That is enough for additive indexes and optional fields.

Add a dedicated migration only when a change rewrites existing data, removes a field, backfills a required field, renames a collection, changes uniqueness, or changes retention semantics. Migrations should be service-owned, idempotent, and documented with:

- target collection
- forward steps
- rollback or mitigation plan
- expected runtime and lock impact
- verification query

Large backfills should page by `_id` or service-owned cursor fields and should not run inside request handlers.
