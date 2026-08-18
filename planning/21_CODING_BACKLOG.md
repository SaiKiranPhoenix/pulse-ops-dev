# PulseOps Coding Backlog

## Repository Setup

| Task | Goal | Depends On | Acceptance |
| --- | --- | --- | --- |
| Initialize pnpm monorepo | create workspace structure | none | `pnpm install`, `pnpm -r build` planned |
| Add TypeScript configs | shared strict TS setup | monorepo | services compile with strict mode |
| Add lint/format tooling | consistent code quality | monorepo | lint and format commands documented |
| Add shared env config package | typed env validation | TS setup | services fail fast on missing env |

## Shared Packages

| Task | Goal | Acceptance |
| --- | --- | --- |
| Logger package | structured logs with redaction | sensitive keys redacted in tests |
| Error package | common API error shape | all APIs return consistent errors |
| Contracts package | API and queue Zod schemas | ingestion and workers share payload schemas |
| RabbitMQ package | confirm publish and manual consume helpers | retry/DLQ integration possible |
| Redis package | safe client and key helpers | TTL and atomic operations covered |
| Crypto utils | hash, random token, AES-GCM wrappers | wrong key fails decrypt |

## Infrastructure

| Task | Goal | Acceptance |
| --- | --- | --- |
| Docker Compose infra | MongoDB, Redis, RabbitMQ, Mailhog | health checks pass |
| Seed script | demo user/project/API key/sample data | raw key printed once for demo only |
| Reset script | safe local reset | deletes only project volumes |
| Index setup | MongoDB indexes | unique and query indexes created |

## Auth And Project Service

| Task | Goal | Acceptance |
| --- | --- | --- |
| Register/login/me | user auth | JWT protects dashboard APIs |
| Project CRUD subset | create/list/detail | owner-only access enforced |
| API key lifecycle | create/list/rotate/disable | raw key returned once, hash stored |
| API key validation | ingestion support | Redis cache-aside works |

## Ingestion Service

| Task | Goal | Acceptance |
| --- | --- | --- |
| Logs endpoint | accept logs | `202` only after RabbitMQ publish |
| Errors endpoint | accept errors | fingerprint inputs validated |
| Metrics endpoint | accept metrics | latency metrics accepted |
| Rate limiting | protect ingestion | threshold returns `429` |
| Idempotency | prevent duplicate accepts | duplicate key returns original result |

## Workers

| Task | Goal | Acceptance |
| --- | --- | --- |
| Log worker | persist log events | event visible in dashboard |
| Error worker | persist and fingerprint errors | Redis counter updates |
| Metric worker | persist latency metrics | p95 input available |
| Incident worker | evaluate repeated errors and latency | incidents created/deduped |
| Audit worker | persist vault audit logs | no sensitive values stored |
| Heartbeat | worker health | stale workers visible |
| Retry/DLQ | resilience | poison message lands in DLQ |

## Dashboard And Realtime

| Task | Goal | Acceptance |
| --- | --- | --- |
| Dashboard auth UI | login/register | user can access protected app |
| Project selector | project/env context | APIs scoped correctly |
| Overview | KPI command center | live metrics visible |
| Live logs | event stream | Socket.IO updates rows |
| Incidents | triage | acknowledge/resolve works |
| Workers/queues | ops visibility | queue depth and worker status visible |
| Vault UI | secrets and tokens | no values in list; reveal modal works |
| Audit UI | sensitive activity | audit events visible live |

## Vault

| Task | Goal | Acceptance |
| --- | --- | --- |
| Secret create/list | encrypted storage | MongoDB has no raw value |
| Secret reveal | controlled decrypt | wrong password fails |
| Secret update/delete | lifecycle | version/audit updated |
| Token create/list/revoke | integration access | raw token shown once |
| Integration fetch | app secret access | token scope enforced |
| Vault audit | compliance trail | every sensitive action logged |

## Testing And Load

| Task | Goal | Acceptance |
| --- | --- | --- |
| Unit tests | core algorithms | fingerprint/redaction/crypto pass |
| API tests | endpoint behavior | auth/ingestion/vault covered |
| Queue tests | retry/DLQ/idempotency | poison message test passes |
| Redis tests | rate/idempotency/cache | TTL behavior passes |
| k6 normal | throughput proof | events accepted and processed |
| k6 incidents | demo proof | incidents created |
| k6 rate limit | admission proof | predictable `429` |

## Suggested Implementation Prompt

Use this after planning is accepted:

```text
Start implementation. Follow planning/SYSTEM_PROMPT.md strictly. Build PulseOps in vertical slices using the planning docs. Do not add out-of-scope features. Start with monorepo setup, Docker Compose infrastructure, auth/project/API key flow, log ingestion through RabbitMQ, worker persistence to MongoDB, Redis rate limiting, and a minimal dashboard that shows live logs.
```
