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

export type OpsSummaryDto = {
  readonly generatedAt: string;
  readonly workers: {
    readonly active: number;
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
  ) {}

  async workers(now: Date = new Date()): Promise<WorkerHealthDto[]> {
    const workers = await this.workersRepository.findActive();

    return workers.map((worker) => ({
      ...worker,
      ageSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(worker.lastSeenAt)) / 1_000)),
    }));
  }

  async queues(): Promise<QueueStatusDto[]> {
    return this.queuesRepository.inspect();
  }

  async summary(): Promise<OpsSummaryDto> {
    const [workers, queues] = await Promise.all([this.workers(), this.queues()]);

    return {
      generatedAt: new Date().toISOString(),
      workers: {
        active: workers.length,
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
