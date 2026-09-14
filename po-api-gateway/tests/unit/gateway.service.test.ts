import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProxyTargets } from "../../src/controllers/proxy.controller.js";
import { GatewayService } from "../../src/services/gateway.service.js";

describe("GatewayService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates upstream health into an ok or degraded gateway status", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }))
      .mockRejectedValueOnce(new Error("connection refused"));

    const health = await new GatewayService(createTargets()).health();

    expect(health.status).toBe("degraded");
    expect(health.services).toEqual([
      expect.objectContaining({ name: "authProject", status: "ok", statusCode: 200 }),
      expect.objectContaining({ name: "vault", status: "unavailable", statusCode: null }),
    ]);
  });

  it("documents gateway, dashboard, proxy, ops, vault, and audit routes", () => {
    const openApi = new GatewayService(createTargets()).openApi();
    const paths = openApi.paths as Record<string, unknown>;

    expect(paths).toHaveProperty("/health/services");
    expect(paths).toHaveProperty("/dashboard/dead-letters");
    expect(paths).toHaveProperty("/vault/{path}");
    expect(paths).toHaveProperty("/audit/events");
    expect(paths).toHaveProperty("/integrations/vault/{path}");
  });

  it("keeps the documented public API surface aligned with implemented route families", () => {
    const openApi = new GatewayService(createTargets()).openApi();
    const documentedPaths = Object.keys(openApi.paths as Record<string, unknown>).sort();

    expect(documentedPaths).toEqual([
      "/audit/events",
      "/auth/{path}",
      "/dashboard/dead-letters",
      "/dashboard/events",
      "/dashboard/incidents",
      "/dashboard/metrics",
      "/dashboard/queues",
      "/dashboard/summary",
      "/dashboard/traces",
      "/dashboard/workers",
      "/health",
      "/health/services",
      "/incidents/{path}",
      "/ingest/{path}",
      "/integrations/vault/{path}",
      "/openapi.json",
      "/ops/{path}",
      "/projects/{path}",
      "/vault/{path}",
    ]);
  });
});

function createTargets(): ProxyTargets {
  return {
    authProject: { baseUrl: "http://auth.local", pathPrefix: "" },
    vault: { baseUrl: "http://vault.local", pathPrefix: "" },
  } as ProxyTargets;
}
