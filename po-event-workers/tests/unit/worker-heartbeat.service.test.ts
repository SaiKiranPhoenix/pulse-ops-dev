import { describe, expect, it } from "vitest";
import type {
  WorkerHeartbeatRecord,
  WorkerHeartbeatRepository,
} from "../../src/repositories/worker-heartbeat.repository.js";
import type { RealtimeWorkerHeartbeatPublisher } from "../../src/events/publishers/realtime-worker-heartbeat.publisher.js";
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

class CapturingRealtimeWorkerHeartbeatPublisher implements RealtimeWorkerHeartbeatPublisher {
  readonly messages: Parameters<RealtimeWorkerHeartbeatPublisher["publish"]>[0][] = [];

  async publish(
    message: Parameters<RealtimeWorkerHeartbeatPublisher["publish"]>[0],
  ): Promise<void> {
    this.messages.push(message);
  }

  async close(): Promise<void> {}
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
        metrics: {
          processed: 0,
          processedByType: {
            log: 0,
            error: 0,
            metric: 0,
          },
          failed: 0,
          retries: 0,
          poisonMessages: 0,
          lastProcessedAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
        startedAt: "2026-08-18T00:00:00.000Z",
        lastSeenAt: "2026-08-18T00:00:05.000Z",
      },
    });
  });

  it("publishes worker heartbeat realtime updates after writing Redis heartbeat", async () => {
    const heartbeats = new InMemoryWorkerHeartbeatRepository();
    const realtime = new CapturingRealtimeWorkerHeartbeatPublisher();
    const service = new WorkerHeartbeatService(
      heartbeats,
      {
        workerId: "worker_1",
        intervalSeconds: 10,
        ttlSeconds: 30,
        startedAt: new Date("2026-08-18T00:00:00.000Z"),
      },
      realtime,
    );

    await service.writeHeartbeat(new Date("2026-08-18T00:00:05.000Z"));

    expect(realtime.messages).toEqual([
      expect.objectContaining({
        messageId: "worker_1:1787011205000",
        schemaVersion: 1,
        worker: expect.objectContaining({ workerId: "worker_1" }),
        occurredAt: "2026-08-18T00:00:05.000Z",
      }),
    ]);
  });
});
