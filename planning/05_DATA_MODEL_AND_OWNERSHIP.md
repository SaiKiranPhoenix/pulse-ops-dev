# PulseOps Data Model And Ownership

## Modeling Rules

- MongoDB stores durable state.
- Redis stores hot or temporary state unless explicitly backed by MongoDB.
- Every collection has one writer-owner service.
- Sensitive values are hashed or encrypted before storage.
- Events use retention limits so local development remains lightweight.
- Dashboard performance depends on indexes plus Redis summaries, not full collection scans.

## Collection Summary

| Collection | Owner | Purpose |
| --- | --- | --- |
| `users` | Auth/Project | user identity |
| `projects` | Auth/Project | project ownership and metadata |
| `apiKeys` | Auth/Project | hashed ingestion keys and lifecycle |
| `events` | Event Workers | normalized logs, errors, metrics |
| `incidents` | Incident | incident state and lifecycle |
| `workerHealth` | Ops | worker heartbeat snapshots |
| `secrets` | Vault | encrypted secret records |
| `vaultTokens` | Vault | hashed integration tokens |
| `vaultAuditLogs` | Audit | durable sensitive operation audit trail |
| `idempotencyRecords` | Ingestion | optional durable idempotency audit for accepted requests |

## Users

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `name` | display name |
| `email` | lowercase unique |
| `passwordHash` | Argon2id or bcrypt hash |
| `createdAt`, `updatedAt` | timestamps |

Indexes:

- unique `{ email: 1 }`

Security:

- Never return `passwordHash`.
- Do not log login request body.

## Projects

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `ownerId` | user id |
| `name` | project name |
| `slug` | owner-scoped stable slug |
| `description` | optional |
| `environments` | allowed values: development, staging, production |
| `createdAt`, `updatedAt` | timestamps |

Indexes:

- `{ ownerId: 1, createdAt: -1 }`
- unique `{ ownerId: 1, slug: 1 }`

Read patterns:

- list projects by owner
- fetch project for ownership check

## API Keys

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `projectId` | owning project |
| `keyHash` | hash of raw key |
| `keyPrefix` | safe display prefix, not enough to authenticate |
| `name` | human label |
| `status` | active, disabled, rotated |
| `scopes` | ingestion permissions |
| `lastUsedAt` | optional |
| `createdAt`, `rotatedAt`, `disabledAt` | lifecycle |

Indexes:

- unique `{ keyHash: 1 }`
- `{ projectId: 1, status: 1 }`

Security:

- Raw key is returned once.
- Cache invalidation is required on disable or rotation.

## Events

Use one `events` collection for MVP with a `type` discriminator: `log`, `error`, `metric`.

Why one collection:

- dashboard timelines need mixed event ordering
- shared retention and project/environment indexes are simpler
- MVP volume is manageable locally

Consider separate collections later if logs dominate volume or metric aggregation grows.

Fields:

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `projectId` | required |
| `environment` | development, staging, production |
| `type` | log, error, metric |
| `service` | app service name |
| `level` | log severity if applicable |
| `message` | redacted message |
| `metadata` | bounded object, redacted |
| `latencyMs` | metric value when applicable |
| `metricName` | optional |
| `fingerprint` | required for errors |
| `sourceTimestamp` | from client |
| `receivedAt` | ingestion accepted time |
| `processedAt` | worker persisted time |
| `ingestionId` | internal id |

Indexes:

- `{ projectId: 1, environment: 1, receivedAt: -1 }`
- `{ projectId: 1, environment: 1, type: 1, receivedAt: -1 }`
- `{ projectId: 1, environment: 1, fingerprint: 1, receivedAt: -1 }`
- TTL on `receivedAt` for local retention, default 7 to 30 days.

Security:

- Redact known sensitive keys from `message` and `metadata`.
- Reject oversized metadata.

MongoDB time-series:

- Do not use time-series collections in MVP. They complicate mixed event queries and local implementation.
- Reconsider for metrics-only data in Version 2.

## Incidents

Fields:

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `projectId` | required |
| `environment` | required |
| `service` | affected service |
| `ruleType` | repeated_error, high_latency, queue_backlog later |
| `fingerprint` | for error incidents |
| `severity` | info, warning, critical |
| `status` | open, acknowledged, resolved |
| `reason` | human-readable trigger |
| `threshold` | triggering threshold metadata |
| `relatedEventIds` | bounded recent event ids |
| `firstSeenAt`, `lastSeenAt`, `resolvedAt` | lifecycle |
| `createdAt`, `updatedAt` | timestamps |

Indexes:

- `{ projectId: 1, environment: 1, status: 1, updatedAt: -1 }`
- unique partial index for open dedupe: `{ projectId: 1, environment: 1, ruleType: 1, fingerprint: 1, service: 1, status: 1 }`

## WorkerHealth

Fields:

- `workerName`
- `workerType`
- `status`
- `lastHeartbeatAt`
- `processedCount`
- `failedCount`
- `currentQueue`
- `version`
- `host`

Indexes:

- unique `{ workerName: 1 }`
- TTL or cleanup policy for stale worker records.

## Secrets

Fields:

| Field | Notes |
| --- | --- |
| `_id` | ObjectId |
| `projectId` | required |
| `environment` | required |
| `key` | environment variable name |
| `encryptedValue` | ciphertext only |
| `iv` | AES-GCM nonce |
| `authTag` | AES-GCM auth tag |
| `salt` | KDF salt |
| `kdf` | argon2id or scrypt parameters |
| `version` | increment on update |
| `createdBy`, `updatedBy` | user ids |
| `createdAt`, `updatedAt`, `deletedAt` | lifecycle |

Indexes:

- unique `{ projectId: 1, environment: 1, key: 1, deletedAt: 1 }`
- `{ projectId: 1, environment: 1, updatedAt: -1 }`

Security:

- Never store raw value.
- Never cache raw value.
- Never include value in list APIs.

## VaultTokens

Fields:

- `projectId`
- `environment`
- `tokenHash`
- `tokenPrefix`
- `name`
- `scopes`
- `status`
- `expiresAt`
- `lastUsedAt`
- `createdBy`
- `createdAt`
- `revokedAt`

Indexes:

- unique `{ tokenHash: 1 }`
- `{ projectId: 1, environment: 1, status: 1 }`
- TTL on `expiresAt` only if expired records can be deleted; otherwise keep for audit.

## VaultAuditLogs

Fields:

- `projectId`
- `environment`
- `actorType`: user, integration_token, system
- `actorId`
- `action`
- `secretKey`
- `tokenPrefix`
- `result`: success, failure
- `failureCode`
- `ipAddress`
- `userAgent`
- `requestId`
- `createdAt`

Indexes:

- `{ projectId: 1, environment: 1, createdAt: -1 }`
- `{ actorType: 1, actorId: 1, createdAt: -1 }`
- retention index after 90 days for MVP unless demo needs longer.

## Embed Versus Reference

- Embed small immutable metadata snapshots in event records.
- Reference users, projects, incidents, and related events by id.
- Keep `relatedEventIds` bounded to avoid unbounded incident documents.
- Store large raw payloads nowhere in MVP.

## Data Never Stored Raw

- user passwords
- vault passwords
- secret values
- API keys
- vault integration tokens
- JWTs
- authorization headers
- database URLs from user metadata
- payment or third-party credentials accidentally included in telemetry
