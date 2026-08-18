# PulseOps API Contracts

## Global API Rules

- Base path: `/api`.
- All JSON endpoints use `Content-Type: application/json`.
- All authenticated dashboard endpoints require `Authorization: Bearer <jwt>`.
- Ingestion endpoints require `x-api-key`.
- Idempotent ingestion can include `idempotency-key`.
- Error responses include `error.code`, `error.message`, and `requestId`.
- Sensitive fields are never echoed.
- Vault reveal/fetch responses use no-store cache headers.

## Common Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request is invalid",
    "details": []
  },
  "requestId": "req_..."
}
```

Common status codes:

- `400` validation error
- `401` missing or invalid auth
- `403` forbidden
- `404` not found
- `409` conflict
- `429` rate limited
- `503` dependency unavailable

## Authentication

| Method | URL | Auth | Body | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | none | name, email, password | user, access token | Auth/Project |
| POST | `/api/auth/login` | none | email, password | user, access token | Auth/Project |
| GET | `/api/auth/me` | JWT | none | current user | Auth/Project |

Notes:

- Password is never logged or returned.
- Login failures return generic `401`.

## Projects And API Keys

| Method | URL | Auth | Body | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/projects` | JWT | name, description, environments | project | Auth/Project |
| GET | `/api/projects` | JWT | none | project list | Auth/Project |
| GET | `/api/projects/:id` | JWT | none | project detail | Auth/Project |
| POST | `/api/projects/:id/api-keys` | JWT | name, scopes | raw key once, prefix, metadata | Auth/Project |
| GET | `/api/projects/:id/api-keys` | JWT | none | safe key metadata only | Auth/Project |
| POST | `/api/projects/:id/api-keys/:keyId/rotate` | JWT | none | new raw key once | Auth/Project |
| PATCH | `/api/projects/:id/api-keys/:keyId/disable` | JWT | none | disabled metadata | Auth/Project |

Security:

- Store only key hash and safe prefix.
- Delete Redis API key cache on rotate/disable.

## Ingestion

| Method | URL | Auth | Headers | Body | Success | Rate Limit |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/ingest/logs` | API key | `x-api-key`, optional `idempotency-key` | service, level, message, metadata, timestamp, environment | `202 Accepted` with ingestion id | per project/env/min |
| POST | `/api/ingest/errors` | API key | same | service, message, stack, metadata, timestamp, environment | `202 Accepted` | per project/env/min |
| POST | `/api/ingest/metrics` | API key | same | service, metricName, value, unit, latencyMs, timestamp, environment | `202 Accepted` | per project/env/min |

Failure behavior:

- invalid API key: `401`
- disabled key: `403`
- duplicate idempotency key: return original accepted response
- RabbitMQ unavailable: `503`
- rate exceeded: `429`

Notes:

- Ingestion does not write full events to MongoDB.
- Success means accepted into RabbitMQ, not fully processed.

## Dashboard

| Method | URL | Auth | Query | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/dashboard/:projectId/summary` | JWT | env, timeRange | counts, rates, p95, active incidents | Dashboard Query |
| GET | `/api/dashboard/:projectId/events` | JWT | env, type, cursor, limit | paginated events | Dashboard Query |
| GET | `/api/dashboard/:projectId/errors` | JWT | env, cursor, limit | error groups/list | Dashboard Query |
| GET | `/api/dashboard/:projectId/workers` | JWT | none | worker health list | Ops |
| GET | `/api/dashboard/:projectId/queues` | JWT | none | queue depth and DLQ summary | Ops |
| GET | `/api/dashboard/:projectId/vault-activity` | JWT | env, cursor | audit log summary | Audit/Dashboard Query |

Caching:

- Summary uses Redis cache-aside.
- Event lists read MongoDB indexes.

## Incidents

| Method | URL | Auth | Body | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/incidents/:projectId` | JWT | none | incident list | Incident |
| GET | `/api/incidents/:projectId/:incidentId` | JWT | none | incident detail | Incident |
| PATCH | `/api/incidents/:incidentId/acknowledge` | JWT | none | updated incident | Incident |
| PATCH | `/api/incidents/:incidentId/resolve` | JWT | resolution note optional | resolved incident | Incident |
| PATCH | `/api/incidents/:incidentId/reopen` | JWT | none | open incident | Incident |

## Vault Dashboard APIs

| Method | URL | Auth | Body | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/vault/:projectId/secrets` | JWT | env, key, value, vaultPassword | safe secret metadata | Vault |
| GET | `/api/vault/:projectId/secrets` | JWT | none | safe metadata list | Vault |
| POST | `/api/vault/:projectId/secrets/:key/reveal` | JWT | env, vaultPassword | key and value | Vault |
| PATCH | `/api/vault/:projectId/secrets/:key` | JWT | env, value, vaultPassword | updated metadata | Vault |
| DELETE | `/api/vault/:projectId/secrets/:key` | JWT | env | deleted metadata | Vault |
| POST | `/api/vault/:projectId/tokens` | JWT | env, name, scopes, expiresAt | raw token once | Vault |
| GET | `/api/vault/:projectId/tokens` | JWT | none | token metadata list | Vault |
| PATCH | `/api/vault/:projectId/tokens/:tokenId/revoke` | JWT | none | revoked metadata | Vault |
| GET | `/api/vault/:projectId/audit-logs` | JWT | env, cursor | audit logs | Audit |

Security:

- Secret list never returns values.
- Reveal requires vault password.
- Token create returns raw token once.
- Every operation writes audit event.

## Vault Integration APIs

| Method | URL | Auth | Query | Success | Owner |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/secrets` | integration token | projectId, env | decrypted key/value map | Vault |
| GET | `/api/v1/secrets/:key` | integration token | projectId, env | decrypted single secret | Vault |

Rate limits:

- per token and per project.

Failure behavior:

- invalid token: `401`
- expired or revoked token: `401`
- wrong project/environment scope: `403`
- missing secret: `404`

## Worker And Admin Health APIs

| Method | URL | Auth | Success | Owner |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | none | service health | API Gateway/Ops |
| GET | `/api/admin/workers` | JWT | worker details | Ops |
| GET | `/api/admin/queues` | JWT | queue depth, consumers, DLQ count | Ops |

## WebSocket Events

| Event | Payload |
| --- | --- |
| `event.created` | project id, env, event summary |
| `metric.updated` | project id, env, metric summary |
| `incident.created` | project id, env, incident summary |
| `incident.updated` | project id, env, status and summary |
| `worker.heartbeat` | worker name, status, timestamp |
| `queue.status` | queue name, depth, consumers, dlq count |
| `vault.audit` | audit-safe activity summary |

Socket rules:

- Client joins `project:{projectId}:env:{env}` after JWT authorization.
- Server must verify project ownership before joining a room.
