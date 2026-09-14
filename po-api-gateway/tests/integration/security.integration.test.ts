import { createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { TOKEN_SETTINGS } from "../../src/config/constants.js";
import { DashboardController } from "../../src/controllers/dashboard.controller.js";
import { GatewayController } from "../../src/controllers/gateway.controller.js";
import { ProxyController, type ProxyTargets } from "../../src/controllers/proxy.controller.js";
import { ServiceController } from "../../src/controllers/service.controller.js";
import type { DashboardRepository } from "../../src/repositories/dashboard.repository.js";
import type { ProjectAuthorizationRepository } from "../../src/repositories/project-authorization.repository.js";
import { DashboardService } from "../../src/services/dashboard.service.js";
import { GatewayService } from "../../src/services/gateway.service.js";
import { ProxyService } from "../../src/services/proxy.service.js";
import { ServiceCatalogService } from "../../src/services/service-catalog.service.js";

const jwtSecret = ["local", "test", "jwt", "signing", "fixture"].join("-");

class CapturingDashboardRepository implements Partial<DashboardRepository> {
  countEventsCalls = 0;

  async countEvents(): Promise<number> {
    this.countEventsCalls += 1;
    return 0;
  }

  async countOpenIncidents(): Promise<number> {
    return 0;
  }
}

class InMemoryProjectAuthorization implements ProjectAuthorizationRepository {
  async canAccessProject(projectId: string, userId: string): Promise<boolean> {
    return projectId === "project_1" && userId === "user_1";
  }
}

class CountingProxyService extends ProxyService {
  forwardCalls = 0;

  override async forward(): Promise<void> {
    this.forwardCalls += 1;
  }
}

describe("gateway security integration", () => {
  it("blocks dashboard reads for projects outside the authenticated user", async () => {
    const dashboard = new CapturingDashboardRepository();
    const app = createApp({
      dependencies: createDependencies(dashboard as DashboardRepository),
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/summary?projectId=project_2`, {
        headers: {
          authorization: `Bearer ${issueToken("user_1")}`,
          "x-request-id": "req_denied_dashboard",
        },
      });

      await expect(response.json()).resolves.toMatchObject({
        error: { code: "FORBIDDEN", message: "Project access denied" },
      });
      expect(response.status).toBe(403);
      expect(dashboard.countEventsCalls).toBe(0);
    });
  });

  it("blocks proxied project APIs before forwarding unauthorized project requests", async () => {
    const proxyService = new CountingProxyService();
    const app = createApp({
      dependencies: createDependencies(
        new CapturingDashboardRepository() as DashboardRepository,
        proxyService,
      ),
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/vault/secrets?projectId=project_2`, {
        headers: {
          authorization: `Bearer ${issueToken("user_1")}`,
          "x-user-id": "spoofed_user",
        },
      });

      await expect(response.json()).resolves.toMatchObject({
        error: { code: "FORBIDDEN", message: "Project access denied" },
      });
      expect(response.status).toBe(403);
      expect(proxyService.forwardCalls).toBe(0);
    });
  });
});

function createDependencies(dashboard: DashboardRepository, proxyService = new ProxyService()) {
  const projectAuthorization = new InMemoryProjectAuthorization();
  const dashboardService = new DashboardService(dashboard, projectAuthorization);
  const serviceCatalogService = new ServiceCatalogService(
    {
      findServicesForProject: async () => [],
      findServiceByName: async () => null,
      upsertService: async (input) => ({
        id: "srv_test",
        projectId: input.projectId,
        name: input.name,
        displayName: input.displayName ?? null,
        description: input.description ?? null,
        ownerName: input.ownerName ?? null,
        ownerEmail: input.ownerEmail ?? null,
        ownerTeam: input.ownerTeam ?? null,
        language: input.language ?? "other",
        runtime: input.runtime ?? "docker",
        tier: input.tier ?? "tier_2",
        repoUrl: input.repoUrl ?? null,
        runbookUrl: input.runbookUrl ?? null,
        deploymentUrl: input.deploymentUrl ?? null,
        tags: input.tags ?? [],
        onboardingChecklist: [],
        isAutoDiscovered: false,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      deleteService: async () => true,
      listDistinctSources: async () => [],
    },
    dashboard,
    projectAuthorization,
  );
  const proxyTargets: ProxyTargets = {
    authProject: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
    audit: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
    ingestion: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
    incident: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
    ops: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
    vault: { baseUrl: "http://127.0.0.1:1", pathPrefix: "" },
  };
  const gatewayService = new GatewayService(proxyTargets);

  return {
    dashboardController: new DashboardController(dashboardService),
    dashboardService,
    serviceController: new ServiceController(serviceCatalogService),
    serviceCatalogService,
    gatewayController: new GatewayController(gatewayService),
    gatewayService,
    proxyController: new ProxyController(proxyService, proxyTargets),
    proxyService,
    projectAuthorization,
    jwtSecret,
    corsAllowedOrigins: "http://localhost:3000",
  };
}

async function withServer(
  app: ReturnType<typeof createApp>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
  }
}

function issueToken(userId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    exp: issuedAt + 60,
    iat: issuedAt,
    iss: TOKEN_SETTINGS.issuer,
    aud: TOKEN_SETTINGS.audience,
  };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signature = createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
