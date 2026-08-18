# PulseOps

PulseOps is a local-first developer operations platform for real-time observability, incident detection, queue-based processing, Redis-backed hot state, and encrypted vault secrets.

## Workspace

This repo is a pnpm monorepo using top-level `po-*` folders:

- `po-ui`: Vite React dashboard.
- `po-shared`: shared contracts and utilities.
- `po-*-service`: backend services and workers.
- `planning`: architecture and implementation planning docs.

## First Local Commands

Use `pnpm.cmd` on Windows if PowerShell blocks `pnpm.ps1`.

```powershell
pnpm.cmd install
Copy-Item .env.example .env
pnpm.cmd workspace:list
pnpm.cmd infra:up
```

Replace the placeholder values in `.env` before starting infra or app containers.

RabbitMQ management UI will be available at `http://localhost:15672` after infra starts.
