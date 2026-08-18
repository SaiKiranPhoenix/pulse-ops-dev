# po-api-gateway Backend Structure

Public HTTP edge, request correlation, security middleware, routing, and aggregate health.

## Folder Rules

- `src/config`: Zod-validated env and service constants.
- `src/routes`: Express routers only; `index.ts` mounts all routers.
- `src/controllers`: `req/res` orchestration only; no business logic.
- `src/services`: gateway routing and edge business logic.
- `src/repositories`: persistence/cache access only if the gateway owns edge state.
- `src/models`: service-owned Mongoose schemas only.
- `src/middlewares`: auth, error handling, audit, request IDs, redaction.
- `src/validators`: request schemas.
- `src/events`: RabbitMQ publishers/consumers.
- `src/sockets`: only if this service pushes realtime data.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: process entry point.

Controllers call services. Services call repositories/events. Repositories never call controllers.
