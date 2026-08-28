import {
  connectRedisClient,
  toIngestionRateLimitKey,
  type PulseRedisClient,
} from "@pulseops/shared";

export type DashboardRateLimitUsage = {
  readonly status: "available";
  readonly limitPerMinute: number;
  readonly windowSeconds: number;
  readonly currentUsage: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
  readonly resetsAt: Date;
};

export interface DashboardRateLimitRepository {
  snapshot(projectId: string, now?: Date): Promise<DashboardRateLimitUsage>;
}

export class RedisDashboardRateLimitRepository implements DashboardRateLimitRepository {
  constructor(
    private readonly redis: PulseRedisClient,
    private readonly limitPerMinute: number,
    private readonly windowSeconds: number,
  ) {}

  async snapshot(projectId: string, now: Date = new Date()): Promise<DashboardRateLimitUsage> {
    const epochMinute = Math.floor(now.getTime() / 60_000);
    const key = toIngestionRateLimitKey(projectId, epochMinute);
    const client = await connectRedisClient(this.redis);
    const [rawCount, rawTtl] = await Promise.all([client.get(key), client.ttl(key)]);
    const currentUsage = parseRedisInteger(rawCount);
    const retryAfterSeconds =
      rawTtl > 0 ? rawTtl : Math.max(1, 60 - Math.floor((now.getTime() % 60_000) / 1_000));

    return {
      status: "available",
      limitPerMinute: this.limitPerMinute,
      windowSeconds: this.windowSeconds,
      currentUsage,
      remaining: Math.max(this.limitPerMinute - currentUsage, 0),
      retryAfterSeconds,
      resetsAt: new Date(now.getTime() + retryAfterSeconds * 1_000),
    };
  }
}

function parseRedisInteger(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
