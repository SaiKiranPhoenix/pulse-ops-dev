import { describe, expect, it } from "vitest";
import type {
  WorkerHeartbeatRecord,
  WorkerHeartbeatRepository,
} from "../../src/repositories/worker-heartbeat.repository.js";
import { WorkerHeartbeatService } from "../../src/services/worker-heartbeat.service.js";

class InMemoryWorkerHeartbeatRepository implements WorkerHeartbeatRepository {
  readonly writes: Array<{
    readonly record: WorkerHeartbeatRecord;
    readonly ttlSeconds: number;
  }> = [];

  async write(record: WorkerHeartbeatRecord, ttlSeconds: number): Promise<void> {
    this.writes.push({ record, ttlSeconds });
  }
}

describe("WorkerHeartbeatService", () => {
  it("writes worker metadata with observed telemetry queues", async () => {
    const heartbeats = new InMemoryWorkerHeartbeatRepository();
    const service = new WorkerHeartbeatService(heartbeats, {
      workerId: "worker_1",
      intervalSeconds: 10,
      ttlSeconds: 30,
      startedAt: new Date("2026-08-18T00:00:00.000Z"),
    });

    await service.writeHeartbeat(new Date("2026-08-18T00:00:05.000Z"));

    expect(heartbeats.writes).toHaveLength(1);
    expect(heartbeats.writes[0]).toMatchObject({
      ttlSeconds: 30,
      record: {
        workerId: "worker_1",
        service: "po-event-workers",
        status: "running",
        queues: ["pulseops.logs.q", "pulseops.errors.q", "pulseops.metrics.q"],
        startedAt: "2026-08-18T00:00:00.000Z",
        lastSeenAt: "2026-08-18T00:00:05.000Z",
      },
    });
  });
});
