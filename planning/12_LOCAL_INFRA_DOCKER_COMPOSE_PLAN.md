# PulseOps Local Infrastructure Docker Compose Plan

## Goal

Run the full MVP locally at zero cost with Docker Compose. The environment should make system design behavior visible: RabbitMQ queues, Redis keys, MongoDB data, workers, API services, dashboard, and k6 load tests.

## Containers

| Container | Responsibility | Ports | Depends On |
| --- | --- | --- | --- |
| `po-ui` | Vite React UI | `3000` | API gateway, realtime gateway |
| `po-api-gateway` | public API gateway | `4000` | MongoDB, Redis, RabbitMQ |
| `po-auth-project-service` | auth, projects, API keys | `4010` internal | MongoDB, Redis, RabbitMQ |
| `po-ingestion-service` | telemetry admission path | `4100` internal | Redis, RabbitMQ |
| `po-event-workers` | event processing workers | `4110` internal | MongoDB, Redis, RabbitMQ |
| `po-incident-service` | incident APIs and worker logic | `4120` internal | MongoDB, Redis, RabbitMQ |
| `po-realtime-gateway` | Socket.IO realtime gateway | `4130` | Redis, RabbitMQ |
| `po-audit-service` | audit event worker/API | `4140` internal | MongoDB, RabbitMQ |
| `po-ops-service` | worker/queue/health APIs | `4150` internal | MongoDB, Redis, RabbitMQ |
| `po-vault-service` | vault APIs, encryption, token validation | `4200` internal | MongoDB, Redis, RabbitMQ |
| `mongodb` | durable data | `27017` | none |
| `redis` | cache and hot state | `6379` | none |
| `rabbitmq` | queue broker | `5672`, `15672` | none |
| `mailhog` | future alert testing | `1025`, `8025` | none |
| `k6` | load test runner profile | none | api/ingestion |

## Local URLs

- Dashboard: `http://localhost:3000`
- API gateway: `http://localhost:4000`
- Realtime gateway: `http://localhost:4130`
- RabbitMQ management: `http://localhost:15672`
- Mailhog UI: `http://localhost:8025`
- MongoDB: `mongodb://localhost:27017/pulseops`
- Redis: `redis://localhost:6379`

Use placeholder credentials only in `.env.example`; copy them into a local `.env` and replace them before running Compose. Never commit real secrets.

## Environment Variables

| Variable | Used By | Notes |
| --- | --- | --- |
| `NODE_ENV` | all services | development/test/production |
| `PORT` | HTTP services | service-specific |
| `MONGODB_URI` | API, workers, vault | local compose URI |
| `REDIS_URL` | API, ingestion, workers, vault | local compose URI |
| `RABBITMQ_URL` | ingestion, workers, audit | local compose URI |
| `JWT_SECRET` | auth/api | placeholder value only in `.env.example`; real local value belongs in ignored `.env` |
| `API_PUBLIC_URL` | dashboard | browser-facing API URL |
| `SOCKET_URL` | dashboard | realtime endpoint |
| `VAULT_KDF` | vault | argon2id preferred |
| `LOG_REDACTION_ENABLED` | all services | default true |
| `RATE_LIMIT_PER_MINUTE` | ingestion | default 600 |

## Health Checks

| Service | Health Check |
| --- | --- |
| dashboard | HTTP `GET /` |
| api | `GET /api/health` |
| ingestion | `GET /health` or gateway health |
| workers | heartbeat key in Redis plus MongoDB `workerHealth` |
| vault | `GET /health` with crypto readiness |
| MongoDB | `db.adminCommand('ping')` |
| Redis | `PING` |
| RabbitMQ | management health endpoint or broker TCP check |

## Volumes

- MongoDB data volume for local persistence.
- RabbitMQ data volume for queue persistence during broker restart tests.
- Redis can use no volume for MVP unless testing restart behavior.

## Development Commands

Planned commands:

- `pnpm dev` starts workspace services in watch mode.
- `pnpm infra:up` starts MongoDB, Redis, RabbitMQ, Mailhog.
- `pnpm apps:build` builds separate app images.
- `pnpm stack:up` starts infra plus all app services with the `apps` Compose profile.
- `docker compose --profile apps up -d --scale po-ingestion-service=3 --scale po-event-workers=3` scales hot-path services locally.
- `pnpm test` runs unit and integration tests.
- `pnpm test:contracts` validates API contracts.
- `pnpm load:normal`, `pnpm load:burst`, `pnpm load:incidents` run k6 scripts.

## Seed Data Strategy

Seed script should create:

- demo user
- demo project
- active API key hash and raw key printed once to console
- sample events
- sample active and resolved incidents
- sample encrypted vault metadata using a clearly marked local-only placeholder vault password from `.env`

Rules:

- Seed values are fake only.
- Seed script must clearly mark local-only placeholder credentials.
- Do not seed real third-party URLs or tokens.

## Safe Reset Strategy

Provide a documented reset command that:

- stops containers
- removes local MongoDB/RabbitMQ/Redis volumes only for this project
- reseeds demo data

The reset command must avoid broad deletion and must never target user home directories.

## Load Test Plan

k6 scripts:

- normal traffic: mixed logs/errors/metrics
- burst traffic: high ingestion rate
- repeated errors: triggers repeated error incident
- high latency: triggers latency incident
- rate limit: proves `429`

Expected evidence:

- ingestion returns `202`
- queue depth rises then drains
- workers process messages
- incidents appear
- dashboard updates live
- DLQ remains empty during healthy tests

## Production-Like Local Settings

Even locally:

- RabbitMQ durable queues enabled.
- manual worker acknowledgements.
- MongoDB indexes created on startup/migration.
- Redis TTLs enabled.
- structured logs with redaction.
- dependency health exposed.
- secrets and tokens never printed.
