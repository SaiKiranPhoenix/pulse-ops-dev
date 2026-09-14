import { toWorkerHeartbeatKey, type PulseRedisClient } from "@pulseops/shared";

export type WorkerHeartbeatRecord = {
  readonly workerId: string;
  readonly service: string;
  readonly status: "running";
  readonly queues: readonly string[];
  readonly metrics: {
    readonly processed: number;
    readonly processedByType: {
      readonly log: number;
      readonly error: number;
      readonly metric: number;
    };
    readonly failed: number;
    readonly retries: number;
    readonly poisonMessages: number;
    readonly lastProcessedAt: string | null;
    readonly lastErrorAt: string | null;
    readonly lastErrorMessage: string | null;
  };
  readonly startedAt: string;
  readonly lastSeenAt: string;
};

export interface WorkerHeartbeatRepository {
  write(record: WorkerHeartbeatRecord, ttlSeconds: number): Promise<void>;
}

export class RedisWorkerHeartbeatRepository implements WorkerHeartbeatRepository {
  constructor(private readonly redis: PulseRedisClient) {}

  async write(record: WorkerHeartbeatRecord, ttlSeconds: number): Promise<void> {
    await this.redis.setEx(
      toWorkerHeartbeatKey(record.workerId),
      ttlSeconds,
      JSON.stringify(record),
    );
  }
}
