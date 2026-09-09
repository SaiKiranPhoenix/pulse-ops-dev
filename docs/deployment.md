# Deployment

PulseOps now defaults to an affordable monolith deployment while preserving the original service
folders as internal boundaries and optional scale-out units.

## Default Monolith Deployment

- `po-backend`: auth/projects, ingestion, event workers, incidents, ops, Vault, audit, API gateway
  dashboard routes, and realtime sockets in one process.
- `po-ui`: dashboard frontend.
- MongoDB, Redis, and RabbitMQ: shared data services.

Run the default local deployment:

```powershell
pnpm.cmd infra:up
pnpm.cmd apps:up
```

Build the monolith backend image:

```powershell
docker build -f po-backend/Dockerfile -t pulseops-backend .
```

The backend exposes `GET /health` and Socket.IO on port `4000`.

## Optional Separate Service Deployment

## Deployable Units

- `po-ui`
- `po-backend`
- `po-api-gateway`
- `po-auth-project-service`
- `po-ingestion-service`
- `po-event-workers`
- `po-incident-service`
- `po-realtime-gateway`
- `po-vault-service`
- `po-audit-service`
- `po-ops-service`

Each unit has its own Dockerfile, runtime environment contract, and container health check. Backend services expose `GET /health`; `po-event-workers` exposes the same endpoint beside its worker process so schedulers can deploy and monitor it as its own unit.

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

Build every microservice image:

```powershell
pnpm.cmd microservices:build
```

Run the full separately deployed local stack:

```powershell
pnpm.cmd microservices:up
```

Scale specific services locally:

```powershell
docker compose --profile microservices up -d --scale po-ingestion-service=3 --scale po-event-workers=3
```

Only services without host-bound ports can be scaled this way. `po-ui`, `po-api-gateway`, and `po-realtime-gateway` expose host ports in local Compose and should normally run as one local instance unless a load balancer is added.

Build one deployable unit at a time:

```powershell
docker build -f po-api-gateway/Dockerfile -t pulseops-api-gateway .
docker build -f po-auth-project-service/Dockerfile -t pulseops-auth-project-service .
docker build -f po-ingestion-service/Dockerfile -t pulseops-ingestion-service .
docker build -f po-event-workers/Dockerfile -t pulseops-event-workers .
docker build -f po-incident-service/Dockerfile -t pulseops-incident-service .
docker build -f po-realtime-gateway/Dockerfile -t pulseops-realtime-gateway .
docker build -f po-vault-service/Dockerfile -t pulseops-vault-service .
docker build -f po-audit-service/Dockerfile -t pulseops-audit-service .
docker build -f po-ops-service/Dockerfile -t pulseops-ops-service .
docker build -f po-ui/Dockerfile -t pulseops-ui .
```

The Docker build context is the repository root because backend images compile and package `@pulseops/shared` with the selected service. Runtime containers still start one service process each.

## UI Runtime Configuration

`po-ui` can be deployed once and pointed at different backend deployments at container start:

```powershell
docker run -p 3000:8080 `
  -e PULSEOPS_API_BASE_URL=https://api.example.com `
  -e PULSEOPS_REALTIME_URL=https://realtime.example.com `
  pulseops-ui
```

The older `VITE_API_BASE_URL` and `VITE_REALTIME_URL` values still work for local development builds, but container deployment should prefer `PULSEOPS_API_BASE_URL` and `PULSEOPS_REALTIME_URL`.

## Health Checks

Every deployable image includes a Docker health check:

- `po-ui`: `GET /health` on port `8080`
- `po-backend`: `GET /health` on port `4000`
- `po-api-gateway`: `GET /health` on port `4000` in microservice mode
- `po-auth-project-service`: `GET /health` on port `4010`
- `po-ingestion-service`: `GET /health` on port `4100`
- `po-event-workers`: `GET /health` on port `4110`
- `po-incident-service`: `GET /health` on port `4120`
- `po-realtime-gateway`: `GET /health` on port `4130`
- `po-audit-service`: `GET /health` on port `4140`
- `po-ops-service`: `GET /health` on port `4150`
- `po-vault-service`: `GET /health` on port `4200`

## Free-Tier CI/CD

The `Container Images` GitHub Actions workflow builds every service image separately.

- Pull requests build images without pushing.
- Pushes to `main`, `master`, or `development` publish images to GitHub Container Registry using `GITHUB_TOKEN`.
- No paid deployment provider is required.

Branch flow is controlled by the `PR Review Guardrails` workflow:

- feature branches merge into `development`
- only `development` or `hotfix/*` branches merge into `main`/`master`
- hotfix branches must include a reason and back-merge plan

## Production Direction

For higher-scale deployment, run one image per service behind a gateway/load balancer:

- scale `po-ingestion-service` for ingestion throughput
- scale `po-event-workers` for queue drain rate
- scale `po-realtime-gateway` for websocket fanout
- keep `po-vault-service` isolated and conservatively scaled
- keep MongoDB, Redis, and RabbitMQ as managed or dedicated infrastructure in a real deployment

Do not merge service runtimes for the PulseOps target architecture.
