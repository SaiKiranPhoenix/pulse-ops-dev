# po-vault-service Backend Structure

Owns encrypted secrets, vault password verification, integration tokens, secret reveal/fetch APIs, and vault audit publishing.

## Folder Rules

- `src/config`: Zod-validated env and vault constants.
- `src/routes`: dashboard vault and integration API routers.
- `src/controllers`: request/response handling only.
- `src/services`: secret encryption/reveal/update/delete, token lifecycle, and audit orchestration.
- `src/repositories`: MongoDB secret/token access and Redis token cache.
- `src/models`: `secrets` and `vaultTokens` Mongoose schemas.
- `src/middlewares`: JWT auth, integration token auth, error handling, audit hooks.
- `src/validators`: vault request schemas.
- `src/events/publishers`: vault audit event producers.
- `src/events/consumers`: unused unless token/secret control events are added.
- `src/sockets`: unused.
- `src/app.ts`: Express app wiring.
- `src/server.ts`: HTTP server entry point.

Never store or log raw secrets, vault passwords, raw integration tokens, JWTs, or authorization headers.
