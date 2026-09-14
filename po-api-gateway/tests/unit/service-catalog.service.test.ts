import { describe, expect, it } from "vitest";
import type { DashboardRepository } from "../../src/repositories/dashboard.repository.js";
import type { ProjectAuthorizationRepository } from "../../src/repositories/project-authorization.repository.js";
import type {
  SafeServiceRecord,
  ServiceRepository,
} from "../../src/repositories/service.repository.js";
import {
  calculateHealthScore,
  ServiceCatalogService,
} from "../../src/services/service-catalog.service.js";

describe("ServiceCatalogService", () => {
  it("computes health score correctly with penalties and checklist readiness", () => {
    // 0 errors, 0 incidents, normal latency, all checklist items completed => 100
    const perfectHealth = calculateHealthScore({
      errorRate: 0,
      openIncidents: [],
      p95LatencyMs: 120,
      checklist: [{ completed: true }, { completed: true }],
    });
    expect(perfectHealth.score).toBe(100);
    expect(perfectHealth.status).toBe("healthy");

    // 5% error rate (20 pts penalty), 1 critical incident (30 pts penalty), p95 800ms (12 pts penalty)
    const degradedHealth = calculateHealthScore({
      errorRate: 5,
      openIncidents: [
        {
          id: "inc_1",
          projectId: "p_1",
          fingerprint: "f_1",
          title: "Payment timeout",
          summary: null,
          severity: "critical",
          status: "open",
          eventCount: 10,
          creationReason: "Error spike",
          acknowledgedAt: null,
          resolutionNote: null,
          samples: [],
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      p95LatencyMs: 800,
      checklist: [{ completed: true }, { completed: false }],
    });
    expect(degradedHealth.score).toBeLessThan(70);
    expect(degradedHealth.status).toBe("critical");
  });

  it("auto-discovers services from telemetry sources and lists them", async () => {
    const fakeServiceRepo = createFakeServiceRepository();
    const fakeDashboardRepo = createFakeDashboardRepository();
    const fakeProjectAuth = allowProjectAccess();

    const service = new ServiceCatalogService(fakeServiceRepo, fakeDashboardRepo, fakeProjectAuth);

    const list = await service.listServices("user_1", "project_1");
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((s) => s.name === "checkout-api")).toBe(true);
    expect(list.some((s) => s.name === "auth-worker")).toBe(true);
  });

  it("builds dependency map and details for a specific service", async () => {
    const fakeServiceRepo = createFakeServiceRepository();
    const fakeDashboardRepo = createFakeDashboardRepository();
    const fakeProjectAuth = allowProjectAccess();

    const service = new ServiceCatalogService(fakeServiceRepo, fakeDashboardRepo, fakeProjectAuth);

    const detail = await service.getServiceDetail("user_1", "project_1", "checkout-api");
    expect(detail.name).toBe("checkout-api");
    expect(detail.dependencies.outbound).toEqual(
      expect.arrayContaining([expect.objectContaining({ service: "payment-api", callCount: 45 })]),
    );
  });
});

function allowProjectAccess(): ProjectAuthorizationRepository {
  return {
    async canAccessProject() {
      return true;
    },
  };
}

function createFakeServiceRepository(): ServiceRepository {
  const store = new Map<string, SafeServiceRecord>();

  return {
    async findServicesForProject(projectId: string) {
      return [...store.values()].filter((s) => s.projectId === projectId);
    },
    async findServiceByName(projectId: string, name: string) {
      return store.get(`${projectId}:${name}`) ?? null;
    },
    async upsertService(input) {
      const record: SafeServiceRecord = {
        id: "srv_123",
        projectId: input.projectId,
        name: input.name,
        displayName: input.displayName ?? input.name,
        description: input.description ?? null,
        ownerName: input.ownerName ?? null,
        ownerEmail: input.ownerEmail ?? null,
        ownerTeam: input.ownerTeam ?? null,
        language: input.language ?? "nodejs",
        runtime: input.runtime ?? "docker",
        tier: input.tier ?? "tier_2",
        repoUrl: input.repoUrl ?? null,
        runbookUrl: input.runbookUrl ?? null,
        deploymentUrl: input.deploymentUrl ?? null,
        tags: input.tags ?? [],
        onboardingChecklist: input.onboardingChecklist ?? [],
        isAutoDiscovered: input.isAutoDiscovered ?? false,
        status: input.status ?? "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(`${input.projectId}:${input.name}`, record);
      return record;
    },
    async deleteService(projectId: string, name: string) {
      return store.delete(`${projectId}:${name}`);
    },
    async listDistinctSources() {
      return ["checkout-api", "auth-worker", "payment-api"];
    },
  };
}

function createFakeDashboardRepository(): DashboardRepository {
  return {
    async countEvents() {
      return 100;
    },
    async countOpenIncidents() {
      return 0;
    },
    async pagedEvents() {
      return { events: [], nextCursor: null };
    },
    async latestIncidents() {
      return [];
    },
    async latestVaultActivity() {
      return [];
    },
    async ingestionStats() {
      return {
        acceptedCount: 50,
        processedCount: 50,
        droppedCount: 0,
        rateLimitedCount: 0,
        acceptedBySource: [],
        acceptedByType: [],
        latestAcceptedAt: new Date(),
        latestProcessedAt: new Date(),
      };
    },
    async errorGroups() {
      return [];
    },
    async metricSummary() {
      return {
        totalEvents: 100,
        logCount: 80,
        errorCount: 2,
        metricCount: 18,
        errorRate: 2,
        avgLatencyMs: 140,
        p95LatencyMs: 280,
        buckets: [],
        services: [
          {
            service: "checkout-api",
            events: 60,
            logs: 50,
            errors: 1,
            metrics: 9,
            errorRate: 1.6,
            avgLatencyMs: 120,
          },
        ],
        metricSamples: [],
      };
    },
    async traceSummary() {
      return {
        totalTraces: 20,
        totalSpans: 60,
        errorTraces: 0,
        slowTraces: 0,
        serviceCount: 3,
        slowThresholdMs: 500,
        traces: [],
        endpoints: [],
        serviceMap: [
          {
            from: "checkout-api",
            to: "payment-api",
            spanCount: 45,
            errorCount: 0,
            avgDurationMs: 85,
          },
        ],
      };
    },
  };
}
