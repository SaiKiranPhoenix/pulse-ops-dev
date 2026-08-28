import { describe, expect, it } from "vitest";

import { toWorkerHeartbeatKey } from "@pulseops/shared";
import { RedisWorkerHeartbeatRepository } from "../../src/repositories/worker-heartbeat.repository.js";

describe("RedisWorkerHeartbeatRepository", () => {
  it("writes worker heartbeats with the configured TTL", async () => {
    const redis = new FakeRedisClient();
    const repository = new RedisWorkerHeartbeatRepository(redis.asClient());

    await repository.write(
      {
        workerId: "worker_1",
        service: "po-event-workers",
        status: "running",
        queues: ["pulseops.logs.q"],
        metrics: {
          processed: 1,
          processedByType: { log: 1, error: 0, metric: 0 },
          failed: 0,
          retries: 0,
          poisonMessages: 0,
          lastProcessedAt: "2026-08-18T00:00:00.000Z",
          lastErrorAt: null,
          lastErrorMessage: null,
        },
        startedAt: "2026-08-18T00:00:00.000Z",
        lastSeenAt: "2026-08-18T00:00:10.000Z",
      },
      30,
    );

    expect(redis.setExCalls).toEqual([
      {
        key: toWorkerHeartbeatKey("worker_1"),
        ttlSeconds: 30,
      },
    ]);
  });
});

class FakeRedisClient {
  readonly setExCalls: Array<{ readonly key: string; readonly ttlSeconds: number }> = [];

  asClient() {
    return this as never;
  }

  async setEx(key: string, ttlSeconds: number, _value: string): Promise<void> {
    this.setExCalls.push({ key, ttlSeconds });
  }
}
