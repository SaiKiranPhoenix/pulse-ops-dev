# po-audit-service Backend Structure

Consumes audit events, validates safe audit payloads, persists durable audit records, and exposes audit query APIs.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: audit query routers.
- `src/controllers`: request/response handling only.
- `src/services`: audit validation, persistence orchestration, and query logic.
- `src/repositories`: MongoDB audit log access.
- `src/models`: `vaultAuditLogs` and future audit schemas.
- `src/middlewares`: JWT auth, error handling, audit hooks.
- `src/validators`: audit query and queue payload schemas.
- `src/events/consumers`: RabbitMQ audit consumers.
- `src/events/publishers`: only for audit-derived events if needed.
- `src/sockets`: unused.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: audit worker/API entry point.

Audit records must use allowlisted safe fields only.
