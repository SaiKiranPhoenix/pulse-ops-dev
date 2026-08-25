import { describe, expect, it } from "vitest";
import type {
  QueueStatusRecord,
  QueueStatusRepository,
} from "../../src/repositories/queue-status.repository.js";
import type {
  WorkerHealthRecord,
  WorkerHealthRepository,
} from "../../src/repositories/worker-health.repository.js";
import { OpsService } from "../../src/services/ops.service.js";

class InMemoryWorkerHealthRepository implements WorkerHealthRepository {
  constructor(private readonly records: WorkerHealthRecord[]) {}

  async findActive(): Promise<WorkerHealthRecord[]> {
    return this.records;
  }
}

class InMemoryQueueStatusRepository implements QueueStatusRepository {
  constructor(private readonly records: QueueStatusRecord[]) {}

  async inspect(): Promise<QueueStatusRecord[]> {
    return this.records;
  }
}

describe("OpsService", () => {
  it("adds heartbeat age and summarizes observed queues", async () => {
    const service = new OpsService(
      new InMemoryWorkerHealthRepository([
        {
          workerId: "worker_1",
          service: "po-event-workers",
          status: "running",
          queues: ["pulseops.logs.q"],
          metrics: {
            processed: 9,
            processedByType: {
              log: 5,
              error: 3,
              metric: 1,
            },
            failed: 2,
            retries: 1,
            poisonMessages: 2,
            lastProcessedAt: "2026-08-18T00:00:04.000Z",
            lastErrorAt: "2026-08-18T00:00:06.000Z",
            lastErrorMessage: "Invalid telemetry",
          },
          startedAt: "2026-08-18T00:00:00.000Z",
          lastSeenAt: "2026-08-18T00:00:05.000Z",
        },
      ]),
      new InMemoryQueueStatusRepository([
        {
          name: "pulseops.logs.q",
          status: "available",
          messageCount: 7,
          consumerCount: 1,
        },
        {
          name: "pulseops.dead-letter.q",
          status: "missing",
          messageCount: null,
          consumerCount: null,
        },
      ]),
    );

    await expect(service.workers(new Date("2026-08-18T00:00:15.000Z"))).resolves.toEqual([
      {
        workerId: "worker_1",
        service: "po-event-workers",
        status: "running",
        queues: ["pulseops.logs.q"],
        metrics: {
          processed: 9,
          processedByType: {
            log: 5,
            error: 3,
            metric: 1,
          },
          failed: 2,
          retries: 1,
          poisonMessages: 2,
          lastProcessedAt: "2026-08-18T00:00:04.000Z",
          lastErrorAt: "2026-08-18T00:00:06.000Z",
          lastErrorMessage: "Invalid telemetry",
        },
        startedAt: "2026-08-18T00:00:00.000Z",
        lastSeenAt: "2026-08-18T00:00:05.000Z",
        ageSeconds: 10,
      },
    ]);

    await expect(service.summary()).resolves.toMatchObject({
      workers: { active: 1, processed: 9, failed: 2, retries: 1, poisonMessages: 2 },
      queues: {
        observed: 2,
        available: 1,
        missing: 1,
        totalMessages: 7,
        totalConsumers: 1,
      },
    });
  });
});
