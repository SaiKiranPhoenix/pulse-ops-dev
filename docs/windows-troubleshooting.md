# Windows & Local Runtime Troubleshooting Guide

This guide addresses common questions, platform-specific quirks on Windows / macOS / Linux, and operator workflows for running PulseOps locally.

---

## 1. Fast Local Dev Mode (No Docker Rebuilds)

To develop rapidly without waiting for `docker compose build` on every code change:

1. Start only the backing infrastructure in Docker:
   ```bash
   pnpm infra:up
   ```
2. Run `.env` validation to ensure environment variables are sound:
   ```bash
   pnpm env:validate
   ```
3. Run services on the host using `tsx watch` (hot reloading):
   ```bash
   pnpm dev
   ```
   _Note: On the host, services connect to `localhost:27018` for MongoDB and `localhost:6379` for Redis._

---

## 2. Docker & Container Port Conflicts

### MongoDB / MongoDB Compass (Port 27018 vs 27017)

- PulseOps maps MongoDB container port `27017` to host port `27018` (`27018:27017`) in `compose.yaml`.
- This prevents conflicts with local MongoDB instances or Compass default daemon running on `27017`.
- **To connect Compass or mongosh locally:**
  ```text
  mongodb://localhost:27018/pulseops
  ```

### Redis (Port 6379)

- If port `6379` is already bound by a local Redis service:
  - Stop the local service (`Stop-Service redis` or `net stop redis` on Windows), or
  - Update `compose.yaml` and `.env` to map to an alternate port (e.g. `6380:6379`).

### RabbitMQ Management UI (Port 15672) & AMQP (Port 5672)

- Management UI: [http://localhost:15672](http://localhost:15672)
- Default credentials in `.env`: `pulseops_local` / configured password.

---

## 3. Recreating an Environment-Only Service

If you change environment variables in `.env` for a specific service (for example, `po-api-gateway`) and only want to recreate that container without touching others:

```bash
# Recreate a single service with updated environment
docker compose --profile apps up -d --no-deps po-api-gateway

# Recreate a worker service
docker compose --profile workers up -d --no-deps po-event-workers
```

---

## 4. Docker Compose Profiles

PulseOps supports targeted compose profiles for flexible resource usage:

| Profile / Target | Command           | Description                                                   |
| ---------------- | ----------------- | ------------------------------------------------------------- |
| **Infra only**   | `pnpm infra:up`   | Starts MongoDB, Redis, RabbitMQ, MailHog                      |
| **Workers only** | `pnpm workers:up` | Starts infra + event workers, incident service, audit service |
| **Full Stack**   | `pnpm apps:up`    | Starts infra + all backend services + UI                      |

---

## 5. Windows-Specific Quirks & Tips

### WSL 2 Backend & File Performance

- Always clone and run PulseOps inside the WSL 2 Linux filesystem (e.g., `~/projects/pulse-ops`) or ensure Docker Desktop uses WSL 2 engine.
- Storing files in `/mnt/c/` can result in slower file I/O during heavy `pnpm install` or compilation.

### Line Endings (CRLF vs LF)

- Git on Windows may convert files to CRLF.
- Shell scripts or Docker multi-stage builds require LF line endings.
- Run `pnpm format` to auto-normalize formatting across the repository.

### PowerShell Command Separators

- In Windows PowerShell 5.1, `&&` is not a valid separator. Use `;` instead:
  ```powershell
  # Recommended for cross-version PowerShell
  pnpm infra:up ; pnpm demo:seed
  ```

### Docker Build Slowness

- If builds feel slow, enable Docker BuildKit:
  ```powershell
  $env:DOCKER_BUILDKIT=1
  ```
- Dependency layers are cached using `pnpm fetch` and multi-stage Dockerfiles.

---

## 6. Local Stack Health Dashboard

To instantly inspect the status, exposed ports, Docker state, and HTTP probe latencies across all services:

```bash
pnpm health
```
