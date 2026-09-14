# po-realtime-gateway Backend Structure

Authenticates socket clients, authorizes project/environment rooms, consumes realtime events, and pushes dashboard updates.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: optional health routes.
- `src/controllers`: optional health controllers only.
- `src/services`: room join, authorization, reconnect, and emit orchestration.
- `src/repositories`: Redis adapter or room/session state access if needed.
- `src/models`: avoid unless this service owns durable state later.
- `src/middlewares`: HTTP auth/error/audit middleware.
- `src/validators`: socket and health schemas.
- `src/events/consumers`: RabbitMQ realtime consumers.
- `src/events/publishers`: gateway-originated events only if needed.
- `src/sockets`: Socket.IO namespaces, rooms, and event handlers.
- `src/app.ts`: Express and Socket.IO wiring.
- `src/server.ts`: realtime server entry point.

Never let sockets join a project room without ownership authorization.
