import { toWorkerHeartbeatPattern, type PulseRedisClient } from "@pulseops/shared";
import { z } from "zod";

const workerHeartbeatSchema = z.object({
  workerId: z.string().min(1),
  service: z.string().min(1),
  status: z.literal("running"),
  queues: z.array(z.string().min(1)),
  metrics: z
    .object({
      processed: z.number().int().min(0),
      processedByType: z.object({
        log: z.number().int().min(0),
        error: z.number().int().min(0),
        metric: z.number().int().min(0),
      }),
      failed: z.number().int().min(0),
      retries: z.number().int().min(0),
      poisonMessages: z.number().int().min(0),
      lastProcessedAt: z.string().datetime().nullable(),
      lastErrorAt: z.string().datetime().nullable(),
      lastErrorMessage: z.string().nullable(),
    })
    .default({
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
    }),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export type WorkerHealthRecord = z.infer<typeof workerHeartbeatSchema>;

export interface WorkerHealthRepository {
  findActive(): Promise<WorkerHealthRecord[]>;
}

export class RedisWorkerHealthRepository implements WorkerHealthRepository {
  constructor(private readonly redis: PulseRedisClient) {}

  async findActive(): Promise<WorkerHealthRecord[]> {
    const records: WorkerHealthRecord[] = [];

    for await (const cursorValue of this.redis.scanIterator({
      MATCH: toWorkerHeartbeatPattern(),
      COUNT: 100,
    })) {
      const keys = Array.isArray(cursorValue) ? cursorValue : [cursorValue];

      for (const key of keys) {
        const value = await this.redis.get(key);

        if (value === null) {
          continue;
        }

        const parsed = workerHeartbeatSchema.safeParse(parseJson(value));

        if (parsed.success) {
          records.push(parsed.data);
        }
      }
    }

    return records.sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
