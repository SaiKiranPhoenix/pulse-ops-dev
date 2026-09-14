# PulseOps monolith deployment

PulseOps still keeps the old domain folders, but the affordable deployment path is now one backend
process:

- `po-backend`: API gateway routes, auth/project routes, ingestion routes, incident APIs, ops APIs,
  Vault APIs, audit APIs, realtime sockets, and background consumers.
- `po-ui`: the dashboard frontend.
- MongoDB, Redis, and RabbitMQ remain shared backing services.

Run the monolith stack locally:

```bash
pnpm infra:up
pnpm apps:up
```

Or run the backend directly during development:

```bash
pnpm monolith:dev
```

The backend listens on `4000`. The UI should use the same URL for HTTP and realtime sockets:

```bash
PULSEOPS_API_BASE_URL=http://localhost:4000
MONOLITH_REALTIME_URL=http://localhost:4000
```

The previous many-container deployment is still available for later scale-out:

```bash
pnpm microservices:up
```

That mode starts the original service containers under the `microservices` compose profile.
