import { describe, expect, it } from "vitest";

import type { DashboardRepository } from "../../src/repositories/dashboard.repository.js";
import type { DashboardRateLimitRepository } from "../../src/repositories/ingestion-rate-limit.repository.js";
import type { ProjectAuthorizationRepository } from "../../src/repositories/project-authorization.repository.js";
import { DashboardService } from "../../src/services/dashboard.service.js";

describe("DashboardService", () => {
  it("includes live rate-limit counters when Redis is available", async () => {
    const service = new DashboardService(createDashboardRepository(), allowProjectAccess(), {
      async snapshot() {
        return {
          status: "available",
          limitPerMinute: 20,
          windowSeconds: 60,
          currentUsage: 8,
          remaining: 12,
          retryAfterSeconds: 14,
          resetsAt: new Date("2026-08-18T00:00:14.000Z"),
        };
      },
    });

    await expect(service.ingestionStats("user_1", "project_1", {})).resolves.toMatchObject({
      projectId: "project_1",
      rateLimit: {
        status: "available",
        limitPerMinute: 20,
        currentUsage: 8,
        remaining: 12,
        resetsAt: "2026-08-18T00:00:14.000Z",
      },
    });
  });

  it("falls back gracefully when Redis rate-limit counters are unavailable", async () => {
    const failingRateLimits: DashboardRateLimitRepository = {
      async snapshot() {
        throw new Error("redis unavailable");
      },
    };
    const service = new DashboardService(
      createDashboardRepository(),
      allowProjectAccess(),
      failingRateLimits,
      {
        limitPerMinute: 42,
        windowSeconds: 60,
      },
    );

    await expect(service.ingestionStats("user_1", "project_1", {})).resolves.toMatchObject({
      rateLimit: {
        status: "unavailable",
        limitPerMinute: 42,
        currentUsage: null,
        remaining: null,
      },
    });
  });

  it("blocks dashboard reads for projects the user does not own", async () => {
    const service = new DashboardService(createDashboardRepository(), denyProjectAccess());

    await expect(service.summary("user_1", "project_2")).rejects.toThrow("Project access denied");
  });

  it("serializes incident timestamps in error groups even when read-model timestamps are absent", async () => {
    const observedAt = new Date("2026-08-18T00:00:00.000Z");
    const service = new DashboardService(
      {
        ...createDashboardRepository(),
        async errorGroups() {
          return [
            {
              fingerprint: "payment-provider-timeout",
              source: "checkout-api",
              message: "Payment provider timeout",
              count: 3,
              firstSeenAt: observedAt,
              lastSeenAt: observedAt,
              samples: [],
              stack: null,
              incident: {
                id: "incident_1",
                projectId: "project_1",
                fingerprint: "payment-provider-timeout",
                title: "Payment provider timeout",
                summary: null,
                severity: "high",
                status: "open",
                eventCount: 3,
                creationReason: "Repeated error telemetry matched by fingerprint",
                acknowledgedAt: null,
                resolutionNote: null,
                samples: [],
                firstSeenAt: observedAt,
                lastSeenAt: observedAt,
                resolvedAt: null,
                createdAt: undefined as unknown as Date,
                updatedAt: undefined as unknown as Date,
              },
            },
          ];
        },
      } as DashboardRepository,
      allowProjectAccess(),
    );

    await expect(service.errorGroups("user_1", "project_1", {})).resolves.toMatchObject([
      {
        incident: {
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      },
    ]);
  });
});

function allowProjectAccess(): ProjectAuthorizationRepository {
  return {
    async canAccessProject(projectId: string, userId: string) {
      return projectId === "project_1" && userId === "user_1";
    },
  };
}

function denyProjectAccess(): ProjectAuthorizationRepository {
  return {
    async canAccessProject() {
      return false;
    },
  };
}

function createDashboardRepository(): DashboardRepository {
  return {
    async countEvents() {
      return 0;
    },

    async countOpenIncidents() {
      return 0;
    },

    async ingestionStats() {
      return {
        acceptedEvents: 5,
        processedEvents: 4,
        rejectedEvents: 0,
        processingBacklog: 1,
        latestAcceptedAt: null,
        latestProcessedAt: null,
      };
    },
  } as DashboardRepository;
}
