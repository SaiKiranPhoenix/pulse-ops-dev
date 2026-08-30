import type { ProxyTargets } from "../controllers/proxy.controller.js";

export type UpstreamHealthDto = {
  readonly name: string;
  readonly url: string;
  readonly status: "ok" | "unavailable";
  readonly statusCode: number | null;
  readonly latencyMs: number;
};

export type GatewayHealthDto = {
  readonly status: "ok" | "degraded";
  readonly services: UpstreamHealthDto[];
};

export class GatewayService {
  constructor(private readonly targets: ProxyTargets) {}

  async health(): Promise<GatewayHealthDto> {
    const services = await Promise.all(
      Object.entries(this.targets).map(async ([name, target]) =>
        checkUpstream(name, target.baseUrl),
      ),
    );

    return {
      status: services.every((service) => service.status === "ok") ? "ok" : "degraded",
      services,
    };
  }

  openApi(): Record<string, unknown> {
    return {
      openapi: "3.1.0",
      info: {
        title: "PulseOps API Gateway",
        version: "0.1.0",
      },
      paths: {
        "/openapi.json": { get: { summary: "OpenAPI document" } },
        "/health": { get: { summary: "Gateway health" } },
        "/health/services": { get: { summary: "Gateway and upstream health" } },
        "/auth/{path}": { post: { summary: "Authentication proxy" } },
        "/projects/{path}": { get: { summary: "Project management proxy" } },
        "/ingest/{path}": { post: { summary: "Telemetry ingestion proxy" } },
        "/dashboard/summary": { get: { summary: "Dashboard overview read model" } },
        "/dashboard/events": { get: { summary: "Logs and event explorer read model" } },
        "/dashboard/metrics": { get: { summary: "Metrics read model" } },
        "/dashboard/traces": { get: { summary: "Traces and APM read model" } },
        "/dashboard/incidents": { get: { summary: "Incident read model" } },
        "/dashboard/workers": { get: { summary: "Worker health proxy" } },
        "/dashboard/queues": { get: { summary: "Queue status proxy" } },
        "/dashboard/dead-letters": { get: { summary: "Dead-letter queue inspection proxy" } },
        "/vault/{path}": { get: { summary: "Vault core proxy" } },
        "/audit/events": { get: { summary: "Vault audit event search proxy" } },
        "/ops/{path}": { get: { summary: "Operations proxy" } },
        "/integrations/vault/{path}": { get: { summary: "Vault integration fetch proxy" } },
        "/incidents/{path}": { get: { summary: "Incident management proxy" } },
      },
    };
  }
}

async function checkUpstream(name: string, baseUrl: string): Promise<UpstreamHealthDto> {
  const startedAt = Date.now();

  try {
    const response = await fetch(new URL("/health", ensureTrailingSlash(baseUrl)), {
      signal: AbortSignal.timeout(1_500),
    });

    return {
      name,
      url: baseUrl,
      status: response.ok ? "ok" : "unavailable",
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      name,
      url: baseUrl,
      status: "unavailable",
      statusCode: null,
      latencyMs: Date.now() - startedAt,
    };
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
