# PulseOps MVP Document

## Project Name

PulseOps

## One-Line Description

PulseOps is a developer operations platform that combines real-time observability, incident detection, and encrypted secrets management for modern applications.

## Goal

Build a recruiter-grade MERN project that demonstrates advanced backend and system design concepts including message queueing, caching, worker-based processing, rate limiting, real-time dashboards, failure handling, encrypted vault storage, audit logging, and load testing.

## Target Users

- Backend developers monitoring application health
- DevOps/SRE teams tracking incidents
- Developers managing project environment variables
- Teams needing observability plus secure secret access
- Interviewers/recruiters evaluating real-world backend project depth

## MVP Scope

The MVP should prove the full architecture works end-to-end:

1. A user creates an account and project.
2. The project gets an API key for event ingestion.
3. Client apps send logs, errors, and metrics to PulseOps.
4. The API validates API keys and rate limits requests.
5. Events are pushed into RabbitMQ.
6. Worker services consume and process events asynchronously.
7. Events and incidents are stored in MongoDB.
8. Redis caches hot data and controls rate limits.
9. Incidents are automatically created from repeated errors or high latency.
10. The dashboard updates in real time using WebSockets.
11. Users can store encrypted environment variables in PulseOps Vault.
12. Apps can fetch secrets securely using vault integration tokens.
13. k6 load tests demonstrate high-volume event ingestion.

## Tech Stack

### Refined Planning Decision

The MVP will standardize on TypeScript and Express for backend services. Service boundaries remain microservices-first, and every `po-*` runtime is deployed separately from the start so load can be managed per service.

### Frontend

- React or Next.js
- Tailwind CSS
- Socket.IO client
- Recharts or Chart.js

### Backend

- Node.js
- Express.js
- TypeScript
- Socket.IO
- JWT authentication

### Database

- MongoDB

### Caching

- Redis

### Message Queue

- RabbitMQ

### Workers

- Node.js worker services

### Security

- AES-256-GCM encryption
- Argon2 or scrypt for vault password key derivation
- Hashed API keys
- Hashed vault integration tokens
- Audit logging

### Testing and Load

- k6
- Postman or Bruno

### Infrastructure

- Docker Compose
- Local-first zero-cost setup

## Refined Scope Guardrails

- RabbitMQ, Redis, MongoDB, vault encryption, audit logging, realtime updates, and k6 load tests are required for MVP completion.
- Team RBAC, alert delivery, SDK publishing, Kubernetes, cloud deployment, Prometheus/Grafana, and advanced anomaly detection are postponed.
- Raw secrets, vault passwords, API keys, integration tokens, JWTs, and authorization headers must never be stored or logged.
- API key and integration token raw values are returned once at creation time only.
- Vault secret reveal must require explicit authorization and vault password verification.

## Core Modules

## 1. Authentication Module

### Features

- User registration
- User login
- JWT-based authentication
- Protected dashboard routes

### MVP Requirement

Users should be able to create an account, log in, and manage their own projects.

## 2. Project Module

### Features

- Create project
- View project details
- Generate API key
- Enable or disable API key
- Select environment: development, staging, production

### MVP Requirement

Each project should have a unique API key used by external apps to send observability events.

## 3. Event Ingestion Module

### Endpoints

```http
POST /api/ingest/logs
POST /api/ingest/errors
POST /api/ingest/metrics
```

### Headers

```http
x-api-key: <project_api_key>
idempotency-key: <optional_unique_event_key>
```

### MVP Requirement

The ingestion API should validate the project API key, apply Redis rate limiting, and publish valid events to RabbitMQ instead of processing them directly.

## 4. Queue Processing Module

### Queues

- `logs.queue`
- `errors.queue`
- `metrics.queue`
- `alerts.queue`
- `dead-letter.queue`

### Features

- Async event processing
- Retry failed jobs
- Move poison messages to dead-letter queue
- Track worker health
- Batch processing support for high-volume events

### MVP Requirement

Workers should consume events from RabbitMQ, store processed data in MongoDB, update Redis hot data, and trigger incident detection.

## 5. Redis Caching Module

### Use Redis For

- API key cache
- Rate limiting
- Dashboard summary cache
- Recent metrics cache
- Error deduplication
- Incident threshold counters
- Idempotency key tracking

### MVP Requirement

Redis usage should be meaningful and visible in the architecture, not decorative.

## 6. Incident Detection Module

### Create Incidents When

- Error count crosses threshold within a time window
- p95 latency crosses threshold
- Same error fingerprint repeats too often
- Queue backlog grows too high, optional for MVP

### Incident Fields

- Project ID
- Service name
- Severity
- Status
- Trigger reason
- Related event IDs
- Created timestamp
- Resolved timestamp

### MVP Requirement

At least two automatic incident rules should work:

- repeated error detection
- high latency detection

## 7. Real-Time Dashboard Module

### Dashboard Should Show

- Total events today
- Logs per minute
- Error rate
- Average latency
- p95 latency
- Active incidents
- Recent logs
- Recent errors
- Queue status
- Worker status
- Vault access activity

### MVP Requirement

New events, metrics, incidents, and vault audit entries should appear live without refreshing the page.

## 8. PulseOps Vault Module

PulseOps Vault allows developers to securely store and access project environment variables.

### Features

- Add secrets by project and environment
- Store encrypted environment variables
- Unlock vault using a separate vault password
- Reveal/copy secrets from dashboard
- Generate vault integration tokens
- Fetch secrets from external apps using integration tokens
- Rotate or delete secrets
- Track vault access using audit logs

### Example Secrets

```env
DATABASE_URL=mongodb://...
JWT_SECRET=...
REDIS_URL=...
STRIPE_SECRET_KEY=...
RABBITMQ_URL=...
```

### Security Requirements

- Raw secret values must never be stored directly in MongoDB.
- Vault password must never be stored.
- Secret values must be encrypted before storage.
- Use AES-256-GCM for encryption.
- Use Argon2 or scrypt to derive encryption keys from the vault password.
- Store only encrypted value, IV, auth tag, salt, and metadata.
- Store vault integration tokens as hashes.
- Log every secret create, reveal, update, delete, and token access.

### Dashboard Vault APIs

```http
POST /api/vault/secrets
GET /api/vault/secrets?projectId=<projectId>
POST /api/vault/secrets/:environment/:key/reveal
PUT /api/vault/secrets/:environment/:key
DELETE /api/vault/secrets/:environment/:key?projectId=<projectId>
POST /api/vault/tokens
GET /api/vault/tokens?projectId=<projectId>
POST /api/vault/tokens/:tokenId/revoke?projectId=<projectId>
GET /api/audit/events?projectId=<projectId>
```

### Integration APIs

```http
GET /api/integrations/vault/secrets/:environment/:key
```

### Integration Header

```http
Authorization: Bearer <vault_integration_token>
```

### MVP Requirement

The MVP should support:

- creating encrypted secrets
- revealing secrets after vault password verification
- generating integration tokens
- fetching secrets from an external app using a token
- recording vault audit logs

## 9. Load Testing Module

### Use k6 To Simulate

- Normal traffic
- Burst traffic
- Repeated errors
- High latency metrics
- Rate limit behavior

### MVP Requirement

Include at least one k6 script that sends thousands of events and proves queue-based ingestion works.

## Main Data Models

## User

```js
{
  _id,
  name,
  email,
  passwordHash,
  createdAt
}
```

## Project

```js
{
  _id,
  userId,
  name,
  description,
  apiKeyHash,
  environment,
  createdAt
}
```

## Event

```js
{
  _id,
  projectId,
  type,
  service,
  level,
  message,
  metadata,
  latencyMs,
  fingerprint,
  timestamp
}
```

## Incident

```js
{
  _id,
  projectId,
  service,
  severity,
  status,
  reason,
  fingerprint,
  relatedEvents,
  createdAt,
  resolvedAt
}
```

## WorkerHealth

```js
{
  _id,
  workerName,
  status,
  lastHeartbeat,
  processedCount,
  failedCount
}
```

## Secret

```js
{
  _id,
  projectId,
  environment,
  key,
  encryptedValue,
  iv,
  authTag,
  salt,
  version,
  createdBy,
  createdAt,
  updatedAt
}
```

## VaultToken

```js
{
  _id,
  projectId,
  environment,
  tokenHash,
  scopes,
  expiresAt,
  createdAt,
  lastUsedAt
}
```

## VaultAuditLog

```js
{
  _id,
  projectId,
  actorId,
  action,
  secretKey,
  environment,
  ipAddress,
  userAgent,
  createdAt
}
```

## MVP API List

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

### Projects

```http
POST /api/projects
GET /api/projects
GET /api/projects/:id
POST /api/projects/:id/api-key
```

### Ingestion

```http
POST /api/ingest/logs
POST /api/ingest/errors
POST /api/ingest/metrics
```

### Dashboard

```http
GET /api/dashboard/:projectId/summary
GET /api/dashboard/:projectId/events
GET /api/dashboard/:projectId/incidents
GET /api/dashboard/:projectId/workers
```

### Incidents

```http
GET /api/incidents/:projectId
PATCH /api/incidents/:incidentId/resolve
```

### Vault

```http
POST /api/vault/secrets
GET /api/vault/secrets?projectId=<projectId>
POST /api/vault/secrets/:environment/:key/reveal
PUT /api/vault/secrets/:environment/:key
DELETE /api/vault/secrets/:environment/:key?projectId=<projectId>
POST /api/vault/tokens
GET /api/vault/tokens?projectId=<projectId>
POST /api/vault/tokens/:tokenId/revoke?projectId=<projectId>
GET /api/audit/events?projectId=<projectId>
```

### Vault Integration

```http
GET /api/integrations/vault/secrets/:environment/:key
```

## Caching Strategy

## API Key Cache

- Key: `apiKey:{hash}`
- Purpose: avoid MongoDB lookup on every ingestion request
- TTL: 10 minutes

## Rate Limit

- Key: `rate:{projectId}:{minute}`
- Purpose: limit event ingestion per project
- TTL: 60 seconds

## Dashboard Summary Cache

- Key: `dashboard:{projectId}:summary`
- Purpose: fast dashboard loading
- TTL: 15 to 30 seconds

## Error Deduplication

- Key: `error:{projectId}:{fingerprint}`
- Purpose: track repeated errors
- TTL: 5 minutes

## Idempotency Tracking

- Key: `idem:{projectId}:{idempotencyKey}`
- Purpose: prevent duplicate event processing
- TTL: 24 hours

## Vault Token Cache

- Key: `vaultToken:{tokenHash}`
- Purpose: speed up integration token validation
- TTL: 5 minutes

## Queue Strategy

## Producer

The ingestion API publishes events to RabbitMQ after validation and rate limiting.

## Consumers

- Log worker consumes logs.
- Error worker consumes errors.
- Metric worker consumes metrics.
- Alert worker handles incident notifications.

## Retry Strategy

- Failed jobs retry up to 3 times.
- Failed retries use exponential backoff.
- After max retries, job moves to dead-letter queue.

## Dead-Letter Queue

Stores failed events for debugging and replay.

## Security Strategy

- Hash user passwords.
- Hash API keys before storing.
- Hash vault integration tokens before storing.
- Encrypt all secret values using AES-256-GCM.
- Never log raw secret values.
- Never return secret values in list APIs.
- Require vault password before revealing secrets in dashboard.
- Use integration tokens for app-to-PulseOps secret fetching.
- Add audit logs for all vault-sensitive operations.

## Definition of Done

The MVP is complete when:

- The full system starts with Docker Compose.
- A user can register, log in, and create a project.
- A project can generate an API key.
- External events can be sent using the API key.
- Events are published to RabbitMQ.
- Workers consume and store events.
- Redis handles API key caching and rate limiting.
- Incidents are created automatically.
- Dashboard shows logs, errors, metrics, incidents, and worker status.
- Dashboard updates in real time.
- Users can store encrypted secrets in PulseOps Vault.
- Users can reveal secrets only after providing vault password.
- External apps can fetch secrets using vault integration tokens.
- Vault audit logs are created.
- k6 load test successfully sends high-volume events.
- README explains architecture, caching, queueing, vault encryption, and failure handling.

## Version 2 Features

- Uptime monitoring
- Webhook alerts
- Email alerts using Mailhog
- Role-based team access
- Advanced anomaly detection
- SDK package for Node.js apps
- Event replay from dead-letter queue
- Prometheus and Grafana integration
- Secret version rollback
- Secret expiration
- Secret access policies
- Multi-service trace correlation
- More detailed audit logs

## Resume Bullet

Built PulseOps, a developer operations platform using MERN, Redis, RabbitMQ, and WebSockets, combining real-time observability, incident detection, and encrypted secrets management with high-volume event ingestion, async workers, Redis-backed caching, rate limiting, error fingerprinting, automatic incident detection, AES-256-GCM secret encryption, vault integration tokens, audit logs, live dashboards, retry queues, dead-letter queues, and k6 load testing.
