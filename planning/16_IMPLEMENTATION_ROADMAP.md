# PulseOps Implementation Roadmap

## Strategy

Build vertical slices that cross service boundaries early. Do not build all models, then all APIs, then all UI. Each milestone should produce demo evidence.

## Day 1 Build Order

1. Monorepo setup with pnpm, TypeScript, shared config, validation, logging, and error packages.
2. Docker Compose infrastructure for MongoDB, Redis, RabbitMQ, and RabbitMQ management UI.
3. API gateway/auth/project vertical slice: register, login, create project, generate API key.
4. Ingestion vertical slice: validate API key, rate limit, publish log event to RabbitMQ.
5. Worker vertical slice: consume log event, persist to MongoDB, update worker health.
6. Dashboard vertical slice: project overview shows recent logs and worker status.
7. Socket.IO vertical slice: new log appears live.
8. Error incident slice: repeated error creates incident.
9. Vault slice: create encrypted secret, list metadata, reveal with vault password, audit action.
10. k6 normal traffic script proves ingestion path.

## Day 2 Hardening Order

1. Add metrics ingestion and high latency incident rule.
2. Add idempotency behavior.
3. Add RabbitMQ retry and DLQ paths.
4. Add API key rotation/disable and cache invalidation.
5. Add vault integration tokens and external fetch APIs.
6. Add dashboard pages for errors, incidents, workers/queues, vault audit.
7. Add load scripts for burst, repeated errors, high latency, and rate limits.
8. Add tests for security, queue, Redis, and incident behavior.
9. Polish README with screenshots and diagrams.

## Exact Service Implementation Order

1. shared packages: config, logger, errors, validation, contracts
2. API gateway
3. Auth/Project service
4. Ingestion service
5. Event worker service
6. Dashboard Query service
7. Realtime gateway
8. Incident service/worker
9. Vault service
10. Audit worker
11. Ops/Worker Health service

## API Implementation Order

1. health
2. auth register/login/me
3. projects create/list/detail
4. API key create/list/rotate/disable
5. ingest logs
6. dashboard summary/events
7. ingest errors
8. incidents list/resolve
9. ingest metrics
10. vault secrets create/list/reveal/update/delete
11. vault tokens create/list/revoke
12. vault integration fetch
13. workers/queues admin APIs

## Frontend Implementation Order

1. login/register
2. project list and create
3. overview with summary cards and recent logs
4. live logs
5. incidents
6. errors
7. metrics
8. workers/queues
9. vault secrets
10. vault audit logs
11. settings/API keys

## Worker Implementation Order

1. shared RabbitMQ connection and message envelope validation
2. log worker
3. worker heartbeat
4. error worker with fingerprinting
5. incident evaluation worker for repeated errors
6. metric worker
7. incident evaluation for latency
8. audit worker
9. retry and DLQ handling

## Temporary Mocks Allowed

- Queue depth can be read from RabbitMQ management later; early UI may show worker-known counts.
- Realtime can emit directly from worker before routing through a separate realtime queue.
- Dashboard query behavior can initially live behind the API Gateway route surface, but runtime services must remain separately deployable.
- Incident APIs and incident workers must remain a separate deployable service.

## Must Not Be Mocked For MVP Completion

- RabbitMQ publish/consume path.
- Redis rate limiting.
- Redis idempotency for ingestion.
- MongoDB durable event persistence.
- AES-256-GCM secret encryption.
- Hashed API keys and vault tokens.
- Vault audit logging.
- At least one k6 ingestion test.

## Stop Building And Polish Here

Stop adding features when this demo path works:

1. register/login
2. create project and API key
3. run k6 repeated errors
4. show events entering queues and draining
5. show live dashboard update
6. show incident auto-created
7. create/reveal vault secret
8. fetch secret with integration token
9. show audit log

Then polish README, screenshots, diagrams, and tests.

## Recruiter Demo Path

- Start Docker Compose.
- Open dashboard.
- Create project and API key.
- Run k6 script.
- Show RabbitMQ queues.
- Show live logs and metrics.
- Show incident created from repeated error.
- Show worker health.
- Create vault secret and reveal it.
- Fetch secret with integration token.
- Show audit logs and explain no raw secrets are stored.

## Interview Talking Points

- Why ingestion returns `202` after queue publish.
- Why Redis is used for rate limits and idempotency.
- How manual ack and DLQ prevent message loss loops.
- How incident dedupe avoids alert storms.
- How vault encryption differs from hashing.
- Why service ownership and separate deployment let hot services scale independently.
- What would change for production scale.
