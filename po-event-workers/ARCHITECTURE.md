# po-event-workers Backend Structure

Consumes telemetry queues, persists normalized events, updates Redis hot state, publishes incident evaluation messages, and maintains worker health.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: optional worker health routers.
- `src/controllers`: optional health/admin request handlers only.
- `src/services`: event processing business logic.
- `src/repositories`: MongoDB event writes and Redis counter/cache access.
- `src/models`: `events` and worker-owned schemas.
- `src/middlewares`: health API auth/error/audit middleware when needed.
- `src/validators`: queue payload and health API schemas.
- `src/events/consumers`: RabbitMQ log/error/metric consumers.
- `src/events/publishers`: incident and realtime publishers.
- `src/sockets`: unused.
- `src/app.ts`: optional Express health app wiring.
- `src/server.ts`: worker runtime entry point.

Workers must use manual ack and idempotent writes.
