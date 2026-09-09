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
- Node demo traffic commands for normal traffic, repeated errors, high latency, and rate-limit behavior.
- Optional k6 load scripts remain available for heavier local load testing.

## Workspace

This repo is a pnpm monorepo using top-level `po-*` folders:

- `po-ui`: Vite React dashboard.
- `po-backend`: monolith backend that runs all API modules, realtime sockets, and workers in one process.
- `po-shared`: shared contracts and utilities.
- `po-*-service`: domain service modules kept as internal boundaries and optional scale-out units.
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
- Backend API: `http://localhost:4000`
- Realtime socket: `http://localhost:4000`
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

## Demo Data And Traffic

Seed a reusable local demo account, project, API key, telemetry, vault secret, and vault token:

```powershell
pnpm.cmd demo:seed
```

Reset the local Docker data stores, restart the stack, and seed demo data in one command:

```powershell
pnpm.cmd demo:reset
```

Generate traffic for the project attached to a raw ingestion API key:

```powershell
$env:PULSEOPS_API_KEY="<raw-api-key-shown-once>"
pnpm.cmd demo:traffic
```

Scenario-specific commands are also available:

```powershell
pnpm.cmd load:normal
pnpm.cmd load:incidents
pnpm.cmd load:latency
pnpm.cmd load:rate-limit
pnpm.cmd load:all
```

The traffic script prints dashboard URLs and expected results for Logs, Errors, Metrics, Incidents, and Workers. It does not print the raw API key.

Typical local timings:

- `pnpm.cmd stack:up`: 30 to 90 seconds after images are built.
- `pnpm.cmd demo:seed`: 10 to 30 seconds once the API gateway is healthy.
- `pnpm.cmd demo:smoke`: 15 to 45 seconds on a warm stack.
- `pnpm.cmd demo:traffic`: 5 to 20 seconds for the default scenarios.
- Dashboard events usually appear within 5 to 15 seconds after ingestion, and repeated-error incidents usually appear within 10 to 30 seconds.

Useful overrides:

```powershell
$env:PULSEOPS_API_BASE_URL="http://localhost:4000"
$env:PULSEOPS_DEMO_EMAIL="demo@example.com"
$env:PULSEOPS_DEMO_PASSWORD="<strong-demo-password>"
$env:PULSEOPS_DEMO_VAULT_PASSWORD="<same-value-as-VAULT_MASTER_PASSWORD>"
$env:PULSEOPS_DEMO_TIMEOUT_MS="120000"
pnpm.cmd demo:smoke
```

## Browser E2E Tests

After `pnpm.cmd stack:up`, run the real dashboard journey with Playwright:

```powershell
pnpm.cmd test:e2e:health
pnpm.cmd test:e2e
```

The suite registers a user, creates a project and API key, sends log/error/metric telemetry, checks dashboard updates, exercises incident resolve/reopen, and verifies vault create/reveal/token/audit flows. Set `PULSEOPS_SKIP_STACK_HEALTH=1` only when pointing the suite at a separately managed stack.

## Recruiter Demo Path

1. Start the stack with `pnpm.cmd stack:up`.
2. Run `pnpm.cmd demo:smoke` to prove the backend path end-to-end.
3. Open `http://localhost:3000`. Returning users go directly to the product shell; new users can register and are sent to setup.
4. Create a project from Setup. The dashboard environments are `development`, `staging`, and `production`.
5. Create an API key and keep the raw key shown once.
6. Use the Setup connection snippets to send a test log, error, and metric from the UI.
7. Run demo traffic with that API key, or use the Platform page demo buttons:

```powershell
$env:PULSEOPS_API_KEY="<raw-api-key-shown-once>"
pnpm.cmd demo:traffic
pnpm.cmd load:normal
pnpm.cmd load:incidents
pnpm.cmd load:latency
pnpm.cmd load:rate-limit
```

8. Show logs, metrics, errors, incidents, traces, workers, queue health, realtime state, vault secrets, and vault audit events.
9. Open RabbitMQ management at `http://localhost:15672` to inspect queues.

Optional k6 equivalents are kept for larger bursts:

```powershell
$env:PULSEOPS_API_KEY="<raw-api-key-shown-once>"
k6 run scripts/load/normal-traffic.js
k6 run scripts/load/repeated-errors.js
k6 run scripts/load/high-latency.js
k6 run scripts/load/rate-limit.js
```

Suggested screenshot/GIF proof points:

- `01-register-to-setup`: register, then land on Setup without signing in again.
- `02-project-api-key`: create the first project and ingestion API key.
- `03-connect-app`: copy endpoint, headers, cURL, Node example, and environment variables.
- `04-live-telemetry`: send a UI test event and watch Logs/Metrics/Errors update.
- `05-vault`: create/reveal a vault secret and show audit logs without secret values.
- `06-shell`: project selector, environment selector, time range, realtime badge, mobile navigation, and user menu.

## Local Security Checklist

Before sharing a local demo or pushing a deployment candidate:

- Run `pnpm.cmd ci:local` and confirm formatting, linting, typecheck, build, tests, secret scan, and dependency audit pass.
- Keep `.env` local only. Do not commit real JWT secrets, API key pepper, vault master password, OAuth client secrets, database URLs, Redis URLs, RabbitMQ URLs, raw API keys, or raw vault tokens.
- Use generated demo credentials, then rotate or reset them with `pnpm.cmd db:reset` before handing the environment to someone else.
- Verify project switching in the UI shows only the signed-in user's projects and data.
- Verify dashboard, incidents, audit, and vault requests go through the API gateway instead of directly exposing service ports.
- Verify vault secret reveal still requires the vault password and repeated failures are rate limited.
- Verify list APIs show metadata only: no raw secret values, encrypted payloads, raw tokens, token hashes, or passwords.
- Check logs for redaction after demo traffic. Request logs should not contain `authorization`, cookies, API keys, vault tokens, passwords, or credential-bearing connection strings.

## Vault MVP Limitations

PulseOps Vault is an educational secure-vault feature inside a broader local-first DevOps platform. It is not a production-grade HashiCorp Vault replacement.

- No HSM/KMS-backed seal, unseal, or root key ceremony.
- No dynamic database credentials, leases, renewal, or revocation engines.
- No complex policy language, namespaces, replication, or multi-tenant enterprise controls.
- No high-availability storage backend or disaster recovery workflow.
- No pluggable auth methods beyond the app's JWT and generated integration tokens.
- Audit delivery is best-effort for local MVP availability and is not an immutable enterprise audit backend.

## Common Commands

```powershell
pnpm.cmd workspace:list
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd security:secrets
pnpm.cmd stack:down
```
