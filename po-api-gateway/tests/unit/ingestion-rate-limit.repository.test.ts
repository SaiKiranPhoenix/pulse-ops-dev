import { describe, expect, it } from "vitest";

import { toIngestionRateLimitKey } from "@pulseops/shared";
import { RedisDashboardRateLimitRepository } from "../../src/repositories/ingestion-rate-limit.repository.js";

describe("RedisDashboardRateLimitRepository", () => {
  it("reads the current ingestion rate-limit bucket and TTL for dashboard visibility", async () => {
    const now = new Date("2026-08-18T00:03:10.000Z");
    const redis = new FakeRedisClient();
    const expectedKey = toIngestionRateLimitKey("project_1", Math.floor(now.getTime() / 60_000));
    redis.values.set(expectedKey, "7");
    redis.ttls.set(expectedKey, 25);

    await expect(
      new RedisDashboardRateLimitRepository(redis.asClient(), 10, 60).snapshot("project_1", now),
    ).resolves.toEqual({
      status: "available",
      limitPerMinute: 10,
      windowSeconds: 60,
      currentUsage: 7,
      remaining: 3,
      retryAfterSeconds: 25,
      resetsAt: new Date("2026-08-18T00:03:35.000Z"),
    });
  });
});

class FakeRedisClient {
  readonly isOpen = true;
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number>();

  asClient() {
    return this as never;
  }

  async connect(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async ttl(key: string): Promise<number> {
    return this.ttls.get(key) ?? -2;
  }
}
