# po-ingestion-service Backend Structure

Accepts telemetry, validates API keys, rate-limits, enforces idempotency, and publishes accepted events to RabbitMQ.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: log, error, and metric ingestion routers.
- `src/controllers`: request/response handling only.
- `src/services`: API key validation, rate limiting, idempotency, and publish orchestration.
- `src/repositories`: Redis cache/rate/idempotency access and required validation reads.
- `src/models`: only ingestion-owned schemas, if durable idempotency records are added.
- `src/middlewares`: API key auth, error handling, audit hooks.
- `src/validators`: telemetry request schemas.
- `src/events/publishers`: RabbitMQ telemetry producers.
- `src/events/consumers`: unused unless ingestion later consumes control events.
- `src/sockets`: unused.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: HTTP server entry point.

Return `202` only after RabbitMQ confirm publish succeeds.
