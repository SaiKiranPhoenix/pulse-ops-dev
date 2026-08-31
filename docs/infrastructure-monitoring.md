# Infrastructure & Container Monitoring Guide

PulseOps offers real-time node vitals, Docker container statistics, and infrastructure dependency tracking (RabbitMQ, Redis, MongoDB, Vault) across Kubernetes, VM, and bare-metal environments.

---

## 1. Architecture Overview

Infrastructure monitoring in PulseOps consists of three primary layers:

1. **Host Node Telemetry**: Periodic system heartbeats capturing CPU utilization, memory allocation, root filesystem disk usage, and network I/O.
2. **Docker Container Engine Telemetry**: Continuous streaming of Docker container resource metrics (`/docker.sock` cgroups v1/v2), uptime counters, restart detection, and container-to-service mapping.
3. **Core Dependency Health**: Live status, ping latency, connection counts, and runtime diagnostics for backend datastores and message brokers.

---

## 2. Docker & Container Log Correlation

Every container monitored by PulseOps is tagged with its `containerId`, `serviceName`, and `hostId`.

When inspecting containers in the **Infrastructure Console**, clicking **"View Container Logs"** automatically navigates to the Log Management Pipeline filtering by:
```
attributes.serviceName: "<service>" AND attributes.containerId: "<containerId>"
```

---

## 3. Dependency Health Metrics

PulseOps automatically audits and surfaces deep telemetry for required platform dependencies:

- **RabbitMQ**: Message queue readiness, unacknowledged messages, message publish and delivery rates.
- **Redis**: RAM usage (used vs max), cache hit rate %, operations/sec, and replica connectivity.
- **MongoDB**: Active connections, replica set status (`rs0`), database storage size, index size, and ongoing operations.
- **HashiCorp Vault**: Cluster seal state, lease renewals, active uptime, and token health.

---

## 4. Local Collector Agent Setup

To run the PulseOps infrastructure agent locally or in CI/CD:

```bash
docker run -d \
  --name pulseops-infra-agent \
  --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -e PULSEOPS_API_KEY="<YOUR_INGESTION_API_KEY>" \
  -e PULSEOPS_ENDPOINT="https://api.pulseops.dev" \
  pulseops/agent:latest
```
