import { describe, expect, it } from "vitest";

import type { DashboardRepository } from "../../src/repositories/dashboard.repository.js";
import type { DashboardRateLimitRepository } from "../../src/repositories/ingestion-rate-limit.repository.js";
import { DashboardService } from "../../src/services/dashboard.service.js";

describe("DashboardService", () => {
  it("includes live rate-limit counters when Redis is available", async () => {
    const service = new DashboardService(createDashboardRepository(), {
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

    await expect(service.ingestionStats("project_1", {})).resolves.toMatchObject({
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
    const service = new DashboardService(createDashboardRepository(), failingRateLimits, {
      limitPerMinute: 42,
      windowSeconds: 60,
    });

    await expect(service.ingestionStats("project_1", {})).resolves.toMatchObject({
      rateLimit: {
        status: "unavailable",
        limitPerMinute: 42,
        currentUsage: null,
        remaining: null,
      },
    });
  });
});

function createDashboardRepository(): DashboardRepository {
  return {
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
