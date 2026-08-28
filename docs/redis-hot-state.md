# Redis Hot State

PulseOps uses Redis only for short-lived operational state. Durable product records stay in MongoDB.

## Keys And TTLs

- `apiKey:<keyHash>` caches validated ingestion API key metadata for 600 seconds.
- `rate:<projectId>:<epochMinute>` tracks accepted ingestion attempts for one project/minute and expires after 70 seconds.
- `workerHeartbeat:<workerId>` stores worker health snapshots with the configured heartbeat TTL.

All Redis-owned keys have unit coverage that verifies the TTL-bearing write path.

## Unavailable Behavior

- API key cache reads and writes fail open. Ingestion falls back to MongoDB validation and continues when the key is valid.
- Rate-limit reads/writes fail closed. Ingestion returns `DEPENDENCY_UNAVAILABLE` instead of accepting traffic without a quota decision.
- Dashboard rate-limit counters degrade to `status: unavailable` while keeping the configured limit visible.
- Worker heartbeat writes surface the Redis error to the worker runtime; queue processing remains owned by RabbitMQ consumers.

## Cache Invalidation

API key lifecycle changes invalidate `apiKey:<keyHash>` through the auth/project service:

- API key rotation deletes the old validation cache entry.
- API key disable deletes the validation cache entry.

The ingestion service also rechecks token status and expiration after a cache miss, so an invalidated key cannot keep authenticating through Redis.

## Dashboard Visibility

The Setup dashboard shows the current ingestion rate-limit bucket usage, remaining events, and reset time by reading the same Redis key that ingestion increments. If Redis is unavailable, the dashboard explicitly reports the live counters as unavailable instead of showing stale values.

Vault integration tokens are currently validated from MongoDB, not Redis. The vault diagnostics endpoint reports this as `status: disabled` and `validationMode: database` so operators can see there is no token cache to inspect.
