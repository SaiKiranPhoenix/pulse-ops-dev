import {
  connectRedisClient,
  type PulseRedisClient,
} from "@pulseops/shared";

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
};

export interface IngestionRateLimiter {
  consume(projectId: string): Promise<RateLimitDecision>;
}

export class RedisIngestionRateLimiter implements IngestionRateLimiter {
  constructor(
    private readonly redis: PulseRedisClient,
    private readonly limitPerMinute: number,
    private readonly windowTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async consume(projectId: string): Promise<RateLimitDecision> {
    const now = this.now();
    const epochMinute = Math.floor(now.getTime() / 60_000);
    const key = `rate:${projectId}:${epochMinute}`;
    const client = await connectRedisClient(this.redis);
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, this.windowTtlSeconds);
    }

    const remaining = Math.max(this.limitPerMinute - count, 0);

    return {
      allowed: count <= this.limitPerMinute,
      limit: this.limitPerMinute,
      remaining,
      retryAfterSeconds: secondsUntilNextMinute(now),
    };
  }
}

function secondsUntilNextMinute(now: Date): number {
  return Math.max(1, 60 - Math.floor((now.getTime() % 60_000) / 1000));
}
