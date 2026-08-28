import { describe, expect, it } from "vitest";

import { toApiKeyCacheKey, toIngestionRateLimitKey } from "@pulseops/shared";
import { RedisApiKeyValidationCacheRepository } from "../../src/repositories/api-key-cache.repository.js";
import { RedisIngestionRateLimiter } from "../../src/repositories/rate-limit.repository.js";

describe("ingestion Redis hot state", () => {
  it("stores API key validation results with the configured TTL", async () => {
    const redis = new FakeRedisClient();
    const cache = new RedisApiKeyValidationCacheRepository(redis.asClient(), 600);

    await cache.set("key_hash", {
      projectId: "project_1",
      ownerId: "owner_1",
      scopes: ["logs:write"],
      status: "active",
      expiresAt: null,
    });

    expect(redis.setCalls).toEqual([
      {
        key: toApiKeyCacheKey("key_hash"),
        options: { expiration: { type: "EX", value: 600 } },
      },
    ]);
  });

  it("expires new ingestion rate-limit buckets", async () => {
    const now = new Date("2026-08-18T00:03:10.000Z");
    const redis = new FakeRedisClient();
    const limiter = new RedisIngestionRateLimiter(redis.asClient(), 2, 70, () => now);

    await expect(limiter.consume("project_1")).resolves.toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 50,
    });
    await expect(limiter.consume("project_1")).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });

    expect(redis.expireCalls).toEqual([
      {
        key: toIngestionRateLimitKey("project_1", Math.floor(now.getTime() / 60_000)),
        ttlSeconds: 70,
      },
    ]);
  });
});

class FakeRedisClient {
  readonly isOpen = true;
  readonly values = new Map<string, number>();
  readonly setCalls: Array<{ readonly key: string; readonly options: unknown }> = [];
  readonly expireCalls: Array<{ readonly key: string; readonly ttlSeconds: number }> = [];

  asClient() {
    return this as never;
  }

  async connect(): Promise<void> {}

  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(key: string, _value: string, options: unknown): Promise<void> {
    this.setCalls.push({ key, options });
  }

  async incr(key: string): Promise<number> {
    const nextValue = (this.values.get(key) ?? 0) + 1;
    this.values.set(key, nextValue);
    return nextValue;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    this.expireCalls.push({ key, ttlSeconds });
  }
}
