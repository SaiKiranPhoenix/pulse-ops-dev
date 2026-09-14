# po-ops-service Backend Structure

Owns worker health, queue status, DLQ visibility, dependency health, and internal operational summaries.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: workers, queues, and health routers.
- `src/controllers`: request/response handling only.
- `src/services`: health aggregation, queue status, worker status logic.
- `src/repositories`: MongoDB worker health, Redis heartbeat, and RabbitMQ management reads.
- `src/models`: `workerHealth` and ops-owned schemas.
- `src/middlewares`: JWT auth, error handling, audit hooks.
- `src/validators`: ops/admin request schemas.
- `src/events/consumers`: optional worker heartbeat/control consumers.
- `src/events/publishers`: optional ops realtime publishers.
- `src/sockets`: unused.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: HTTP server entry point.

This service observes PulseOps; it must not mutate business-owned data from other services.
