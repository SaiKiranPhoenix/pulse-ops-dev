# Separate Service Deployment

PulseOps is designed to deploy every runtime independently.

## Deployable Units

- `po-ui`
- `po-api-gateway`
- `po-auth-project-service`
- `po-ingestion-service`
- `po-event-workers`
- `po-incident-service`
- `po-realtime-gateway`
- `po-vault-service`
- `po-audit-service`
- `po-ops-service`

Each unit has its own Dockerfile and can be scaled independently.

## Local Separate Runtime

Create local environment values first:

```powershell
Copy-Item .env.example .env
```

Replace the placeholder values in `.env`. Keep `.env` local and uncommitted.

Start only infrastructure:

```powershell
pnpm.cmd infra:up
```

Build every app image:

```powershell
pnpm.cmd apps:build
```

Run the full separately deployed local stack:

```powershell
pnpm.cmd stack:up
```

Scale specific services locally:

```powershell
docker compose --profile apps up -d --scale po-ingestion-service=3 --scale po-event-workers=3
```

Only services without host-bound ports can be scaled this way. `po-ui`, `po-api-gateway`, and `po-realtime-gateway` expose host ports in local Compose and should normally run as one local instance unless a load balancer is added.

## Free-Tier CI/CD

The `Container Images` GitHub Actions workflow builds every service image separately.

- Pull requests build images without pushing.
- Pushes to `main` or `master` publish images to GitHub Container Registry using `GITHUB_TOKEN`.
- No paid deployment provider is required.

## Production Direction

For production-style deployment, run one image per service behind a gateway/load balancer:

- scale `po-ingestion-service` for ingestion throughput
- scale `po-event-workers` for queue drain rate
- scale `po-realtime-gateway` for websocket fanout
- keep `po-vault-service` isolated and conservatively scaled
- keep MongoDB, Redis, and RabbitMQ as managed or dedicated infrastructure in a real deployment

Do not merge service runtimes for the PulseOps target architecture.
