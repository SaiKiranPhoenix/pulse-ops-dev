# PulseOps

PulseOps is a local-first developer operations platform for real-time observability, incident detection, queue-based processing, Redis-backed hot state, realtime dashboards, and encrypted vault secrets.

## What It Proves

- JWT auth, projects, and one-time API key creation.
- API-key ingestion for logs, errors, and metrics.
- Redis-backed API key cache, rate limiting, idempotency, worker health, and dashboard hot state.
- RabbitMQ publish/consume flow with worker persistence and queue visibility.
- Automatic incident creation from ingested errors.
- Socket.IO-ready realtime event fanout.
- AES-256-GCM vault secrets, password-gated reveal, hashed integration tokens, and audit logs.
- k6 scripts for normal traffic, repeated errors, and rate-limit behavior.
- k6 high-latency metrics scenario for the incident/demo matrix.

## Workspace

This repo is a pnpm monorepo using top-level `po-*` folders:

- `po-ui`: Vite React dashboard.
- `po-shared`: shared contracts and utilities.
- `po-*-service`: backend services and workers.
- `scripts`: CI, security, load-test, and demo automation.
- `planning`: architecture and implementation planning docs.

## Quick Start

Use `pnpm.cmd` on Windows if PowerShell blocks `pnpm.ps1`.

```powershell
pnpm.cmd install
Copy-Item .env.example .env
```

Replace the placeholder values in `.env`, then start the full local stack:

```powershell
pnpm.cmd stack:up
```

Local URLs:

- Dashboard: `http://localhost:3000`
- API gateway: `http://localhost:4000`
- Realtime gateway: `http://localhost:4130`
- RabbitMQ management: `http://localhost:15672`
- Mailhog: `http://localhost:8025`

## Demo Smoke Test

After `pnpm stack:up`, run the end-to-end smoke test:

```powershell
pnpm.cmd demo:smoke
```

The smoke test creates an isolated demo user, project, ingestion API key, vault secret, and vault token. It verifies:

- gateway health
- register/login
- project and API key creation
- log, metric, and error ingestion
- worker persistence visible through dashboard events
- automatic incident creation
- dashboard summary counts
- worker/queue visibility
- vault secret create/reveal with `Cache-Control: no-store`
- vault integration token fetch with `Cache-Control: no-store`
- vault audit events

The script intentionally does not print raw API keys, vault tokens, passwords, or secret values.

Useful overrides:

```powershell
$env:PULSEOPS_API_BASE_URL="http://localhost:4000"
$env:PULSEOPS_DEMO_EMAIL="demo@example.com"
$env:PULSEOPS_DEMO_PASSWORD="<strong-demo-password>"
$env:PULSEOPS_DEMO_VAULT_PASSWORD="<same-value-as-VAULT_MASTER_PASSWORD>"
$env:PULSEOPS_DEMO_TIMEOUT_MS="120000"
pnpm.cmd demo:smoke
```

## Recruiter Demo Path

1. Start the stack with `pnpm.cmd stack:up`.
2. Run `pnpm.cmd demo:smoke` to prove the backend path end-to-end.
3. Open `http://localhost:3000` and log in or register a user.
4. Create a project and API key from the dashboard.
5. Run one of the k6 scripts with that API key:

```powershell
$env:PULSEOPS_API_KEY="<raw-api-key-shown-once>"
k6 run scripts/load/normal-traffic.js
k6 run scripts/load/repeated-errors.js
k6 run scripts/load/high-latency.js
k6 run scripts/load/rate-limit.js
```

6. Show the dashboard events, incidents, worker status, queue status, vault page, and audit events.
7. Open RabbitMQ management at `http://localhost:15672` to inspect queues.

## Common Commands

```powershell
pnpm.cmd workspace:list
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd security:secrets
pnpm.cmd stack:down
```
