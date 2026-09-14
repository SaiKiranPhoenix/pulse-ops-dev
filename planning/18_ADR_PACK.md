# PulseOps Architecture Decision Records

## ADR 001: Microservices-First Over Monolith

Status: Accepted

Context: PulseOps must demonstrate real system design concepts: ingestion, workers, queues, caching, incidents, vault, audit, and realtime dashboards.

Decision: Use microservices-first boundaries with separate runtime deployment for every `po-*` service from the start.

Consequences: Stronger architecture signal and clearer ownership, with more coordination overhead.

Alternatives: A monolith would be faster but less impressive and would blur queue/service ownership.

## ADR 002: RabbitMQ For Queueing

Status: Accepted

Context: Ingestion should be fast and decoupled from event processing.

Decision: Use RabbitMQ with durable queues, manual ack, retries, and DLQs.

Consequences: Clear async behavior and failure handling, but requires local broker setup and consumer idempotency.

Alternatives: Kafka is stronger for event streams but heavier locally. In-memory queues are not acceptable for MVP.

## ADR 003: Redis For Hot State

Status: Accepted

Context: PulseOps needs low-latency rate limits, idempotency, counters, locks, and cache-aside summaries.

Decision: Use Redis for ephemeral and hot-path state.

Consequences: Fast operations and visible system design patterns, with required fallback behavior when Redis is down.

Alternatives: MongoDB-only counters would be simpler but slower and less representative of real systems.

## ADR 004: MongoDB For Product And Event Data

Status: Accepted

Context: Telemetry payloads are flexible and dashboard queries are project/time scoped.

Decision: Use MongoDB collections with careful ownership, indexes, and retention.

Consequences: Flexible data model and local-friendly setup, but requires index discipline.

Alternatives: PostgreSQL would offer relational integrity but less flexible event metadata. Elasticsearch is too heavy for MVP.

## ADR 005: AES-256-GCM For Secrets

Status: Accepted

Context: Vault secrets require encryption with confidentiality and integrity.

Decision: Encrypt secret values with AES-256-GCM.

Consequences: Tampering is detected through auth tags, but nonce uniqueness and key derivation must be correct.

Alternatives: Hashing is not reversible and cannot support reveal/fetch. AES-CBC lacks built-in authentication.

## ADR 006: Argon2id Preferred For Vault Key Derivation

Status: Accepted

Context: Vault password-derived keys must resist brute force.

Decision: Prefer Argon2id; allow scrypt fallback if package constraints require it.

Consequences: Better password-hardening, with extra dependency and CPU cost.

Alternatives: PBKDF2 is widely available but less preferred for modern password-hardening.

## ADR 007: Docker Compose For Local Infrastructure

Status: Accepted

Context: The MVP must be zero-cost and easy to run locally.

Decision: Use Docker Compose for MongoDB, Redis, RabbitMQ, services, workers, and dashboard.

Consequences: Simple local onboarding and reproducible demo. Not a production orchestration solution.

Alternatives: Kubernetes is overkill. Cloud-managed services break zero-cost local-first constraints.

## ADR 008: Socket.IO For Realtime Dashboard

Status: Accepted

Context: Dashboard should update live for events, metrics, incidents, workers, queues, and vault audit.

Decision: Use Socket.IO project/environment rooms.

Consequences: Faster implementation and reconnect support, with some vendor-specific protocol behavior.

Alternatives: Raw WebSockets are lighter but require more reconnection and room logic. SSE is simpler but less flexible.

## ADR 009: Time-Window Incident Detection For MVP

Status: Accepted

Context: MVP needs automatic incidents without complex anomaly detection.

Decision: Use Redis-backed time-window thresholds for repeated errors and high latency.

Consequences: Buildable and explainable. Not adaptive or statistically advanced.

Alternatives: ML anomaly detection is not MVP-suitable. MongoDB aggregation alone is slower for hot counters.

## ADR 010: pnpm TypeScript Monorepo

Status: Accepted

Context: Multiple services need shared contracts and utilities.

Decision: Use pnpm workspaces with apps, services, packages, infra, tests, and planning folders.

Consequences: Good dependency structure and shared typing, with some workspace setup overhead.

Alternatives: Separate repos are too slow for MVP. npm workspaces are acceptable but less strict than pnpm.

## ADR 011: Express TypeScript Over NestJS

Status: Accepted

Context: User preference is Express TypeScript, and speed matters.

Decision: Use Express with explicit local conventions for routing, validation, middleware, and services.

Consequences: Faster and familiar, but architecture must be enforced through folder structure and reviews.

Alternatives: NestJS offers stronger built-in structure but more ceremony.

## ADR 012: One Events Collection For MVP

Status: Accepted

Context: Logs, errors, and metrics must appear in shared timelines and dashboard summaries.

Decision: Store telemetry in one indexed `events` collection with a `type` discriminator.

Consequences: Simpler MVP queries and timelines. High-volume scaling may require split collections later.

Alternatives: Separate collections improve type-specific scaling but complicate timeline queries.
