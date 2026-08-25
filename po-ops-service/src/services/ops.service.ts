import type { RabbitDeadLetterMessage, RabbitDeadLetterReplayResult } from "@pulseops/shared";
import {
  noopRealtimeQueueStatusPublisher,
  type RealtimeQueueStatusPublisher,
} from "../events/publishers/realtime-queue-status.publisher.js";
import type {
  WorkerHealthRecord,
  WorkerHealthRepository,
} from "../repositories/worker-health.repository.js";
import type {
  QueueStatusRecord,
  QueueStatusRepository,
} from "../repositories/queue-status.repository.js";

export type WorkerHealthDto = WorkerHealthRecord & {
  readonly ageSeconds: number;
};

export type QueueStatusDto = QueueStatusRecord;
export type QueueHealthStatus = "clear" | "backlog" | "blocked" | "missing";
export type QueueHealthDto = QueueStatusRecord & {
  readonly health: QueueHealthStatus;
  readonly backlogWarning: string | null;
};

export type DeadLetterMessageDto = RabbitDeadLetterMessage;
export type DeadLetterReplayDto = RabbitDeadLetterReplayResult;

export type OpsSummaryDto = {
  readonly generatedAt: string;
  readonly workers: {
    readonly active: number;
    readonly stale: number;
    readonly processed: number;
    readonly failed: number;
    readonly retries: number;
    readonly poisonMessages: number;
  };
  readonly queues: {
    readonly observed: number;
    readonly available: number;
    readonly missing: number;
    readonly totalMessages: number;
    readonly totalConsumers: number;
  };
};

export class OpsService {
  constructor(
    private readonly workersRepository: WorkerHealthRepository,
    private readonly queuesRepository: QueueStatusRepository,
    private readonly realtimeQueues: RealtimeQueueStatusPublisher = noopRealtimeQueueStatusPublisher,
  ) {}

  async workers(now: Date = new Date()): Promise<WorkerHealthDto[]> {
    const workers = await this.workersRepository.findActive();

    return workers.map((worker) => ({
      ...worker,
      ageSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(worker.lastSeenAt)) / 1_000)),
    }));
  }

  async queues(): Promise<QueueHealthDto[]> {
    const queues = await this.queuesRepository.inspect();
    const queueDtos = queues.map(toQueueHealth);

    try {
      await this.realtimeQueues.publish({
        messageId: `queue-status:${Date.now()}`,
        schemaVersion: 1,
        queues: queueDtos.map(
          ({ health: _health, backlogWarning: _backlogWarning, ...queue }) => queue,
        ),
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Queue inspection responses should not fail because realtime delivery is unavailable.
    }

    return queueDtos;
  }

  async deadLetters(limit = 20): Promise<DeadLetterMessageDto[]> {
    return this.queuesRepository.inspectDeadLetters(Math.min(Math.max(limit, 1), 100));
  }

  async replayDeadLetters(limit = 10): Promise<DeadLetterReplayDto> {
    return this.queuesRepository.replayDeadLetters(Math.min(Math.max(limit, 1), 100));
  }

  async summary(): Promise<OpsSummaryDto> {
    const [workers, queues] = await Promise.all([this.workers(), this.queues()]);

    return {
      generatedAt: new Date().toISOString(),
      workers: {
        active: workers.length,
        stale: workers.filter((worker) => worker.ageSeconds > 30).length,
        processed: workers.reduce((total, worker) => total + worker.metrics.processed, 0),
        failed: workers.reduce((total, worker) => total + worker.metrics.failed, 0),
        retries: workers.reduce((total, worker) => total + worker.metrics.retries, 0),
        poisonMessages: workers.reduce((total, worker) => total + worker.metrics.poisonMessages, 0),
      },
      queues: {
        observed: queues.length,
        available: queues.filter((queue) => queue.status === "available").length,
        missing: queues.filter((queue) => queue.status === "missing").length,
        totalMessages: queues.reduce((total, queue) => total + (queue.messageCount ?? 0), 0),
        totalConsumers: queues.reduce((total, queue) => total + (queue.consumerCount ?? 0), 0),
      },
    };
  }
}

function toQueueHealth(queue: QueueStatusRecord): QueueHealthDto {
  if (queue.status === "missing") {
    return {
      ...queue,
      health: "missing",
      backlogWarning: "Queue has not been declared by a producer or consumer.",
    };
  }

  const messageCount = queue.messageCount ?? 0;
  const consumerCount = queue.consumerCount ?? 0;

  if (messageCount > 0 && consumerCount === 0) {
    return {
      ...queue,
      health: "blocked",
      backlogWarning: "Messages are waiting but no consumers are attached.",
    };
  }

  if (messageCount >= 100) {
    return {
      ...queue,
      health: "backlog",
      backlogWarning: "Queue depth is above the local backlog threshold.",
    };
  }

  return {
    ...queue,
    health: "clear",
    backlogWarning: null,
  };
}
