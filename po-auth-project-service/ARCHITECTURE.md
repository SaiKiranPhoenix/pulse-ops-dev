# po-auth-project-service Backend Structure

Owns user authentication, project ownership, and API key lifecycle.

## Folder Rules

- `src/config`: Zod-validated env and constants.
- `src/routes`: auth, project, and API key routers.
- `src/controllers`: request/response handling only.
- `src/services`: registration, login, project, API key, rotation, disable, and validation logic.
- `src/repositories`: MongoDB and Redis access, one repository per owned collection/cache family.
- `src/models`: `users`, `projects`, and `apiKeys` Mongoose schemas.
- `src/middlewares`: JWT auth, error handling, audit hooks.
- `src/validators`: Zod request schemas.
- `src/events`: API key lifecycle publishers if needed.
- `src/sockets`: unused unless future realtime ownership is added.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: HTTP server entry point.

Never store raw passwords or raw API keys. Raw API keys are returned once.
