# po-incident-service Backend Structure

Owns incident detection, deduplication, lifecycle APIs, and incident update publishing.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: incident lifecycle routers.
- `src/controllers`: request/response handling only.
- `src/services`: repeated-error, high-latency, dedupe, acknowledge, resolve, reopen logic.
- `src/repositories`: MongoDB incident records and Redis time-window counters/locks.
- `src/models`: `incidents` Mongoose schema.
- `src/middlewares`: JWT auth, error handling, audit hooks.
- `src/validators`: incident request schemas.
- `src/events/consumers`: incident evaluation consumers.
- `src/events/publishers`: realtime incident update publishers.
- `src/sockets`: unused.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: HTTP/worker entry point as implemented.

Open incident dedupe is mandatory to avoid alert storms.
