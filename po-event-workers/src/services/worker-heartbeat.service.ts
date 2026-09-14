import { TELEMETRY_QUEUES, type TelemetryEventType } from "@pulseops/shared";
import { SERVICE_NAME } from "../config/constants.js";
import {
  noopRealtimeWorkerHeartbeatPublisher,
  type RealtimeWorkerHeartbeatPublisher,
} from "../events/publishers/realtime-worker-heartbeat.publisher.js";
import type { WorkerHeartbeatRepository } from "../repositories/worker-heartbeat.repository.js";
import type { WorkerProcessingStats } from "./event-worker.service.js";

export type WorkerHeartbeatOptions = {
  readonly workerId: string;
  readonly intervalSeconds: number;
  readonly ttlSeconds: number;
  readonly startedAt?: Date;
  readonly processingStats?: () => WorkerProcessingStats;
};

export class WorkerHeartbeatService {
  private interval: NodeJS.Timeout | null = null;
  private readonly startedAt: Date;

  constructor(
    private readonly heartbeats: WorkerHeartbeatRepository,
    private readonly options: WorkerHeartbeatOptions,
    private readonly realtimeHeartbeats: RealtimeWorkerHeartbeatPublisher = noopRealtimeWorkerHeartbeatPublisher,
  ) {
    this.startedAt = options.startedAt ?? new Date();
  }

  async start(): Promise<void> {
    await this.writeHeartbeat();
    this.interval = setInterval(() => {
      void this.writeHeartbeat();
    }, this.options.intervalSeconds * 1_000);
    this.interval.unref();
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async writeHeartbeat(now: Date = new Date()): Promise<void> {
    const heartbeat = {
      workerId: this.options.workerId,
      service: SERVICE_NAME,
      status: "running" as const,
      queues: workerQueueNames(),
      metrics: this.options.processingStats?.() ?? emptyProcessingStats(),
      startedAt: this.startedAt.toISOString(),
      lastSeenAt: now.toISOString(),
    };

    await this.heartbeats.write(heartbeat, this.options.ttlSeconds);

    try {
      await this.realtimeHeartbeats.publish({
        messageId: `${heartbeat.workerId}:${now.getTime()}`,
        schemaVersion: 1,
        worker: heartbeat,
        occurredAt: now.toISOString(),
      });
    } catch {
      // Durable heartbeat storage is enough for recovery; realtime delivery is best-effort.
    }
  }
}

function emptyProcessingStats(): WorkerProcessingStats {
  return {
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
  };
}

function workerQueueNames(): string[] {
  const types: readonly TelemetryEventType[] = ["log", "error", "metric"];
  return types.map((type) => TELEMETRY_QUEUES[type]);
}
