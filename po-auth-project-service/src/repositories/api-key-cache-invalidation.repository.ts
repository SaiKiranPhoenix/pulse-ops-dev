import {
  connectRedisClient,
  toApiKeyCacheKey,
  type PulseRedisClient,
} from "@pulseops/shared";

export interface ApiKeyCacheInvalidationRepository {
  invalidate(keyHash: string): Promise<void>;
}

export class RedisApiKeyCacheInvalidationRepository
  implements ApiKeyCacheInvalidationRepository
{
  constructor(private readonly redis: PulseRedisClient) {}

  async invalidate(keyHash: string): Promise<void> {
    const client = await connectRedisClient(this.redis);
    await client.del(toApiKeyCacheKey(keyHash));
  }
}
