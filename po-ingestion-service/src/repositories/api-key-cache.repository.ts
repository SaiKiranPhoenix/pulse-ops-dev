import { connectRedisClient, toApiKeyCacheKey, type PulseRedisClient } from "@pulseops/shared";
import { z } from "zod";
import type { VerifiedIngestionApiKey } from "./ingestion-api-key.repository.js";

const cachedApiKeySchema = z.object({
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  scopes: z.array(z.string()),
  status: z.enum(["active", "disabled"]),
  expiresAt: z.string().datetime().nullable(),
});

export interface ApiKeyValidationCacheRepository {
  get(keyHash: string): Promise<VerifiedIngestionApiKey | null>;
  set(keyHash: string, apiKey: VerifiedIngestionApiKey): Promise<void>;
}

export class RedisApiKeyValidationCacheRepository implements ApiKeyValidationCacheRepository {
  constructor(
    private readonly redis: PulseRedisClient,
    private readonly ttlSeconds: number,
  ) {}

  async get(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    const client = await connectRedisClient(this.redis);
    const cached = await client.get(toApiKeyCacheKey(keyHash));

    if (cached === null) {
      return null;
    }

    const parsed = cachedApiKeySchema.safeParse(parseCachedValue(cached));

    if (!parsed.success) {
      return null;
    }

    return {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt),
    };
  }

  async set(keyHash: string, apiKey: VerifiedIngestionApiKey): Promise<void> {
    const client = await connectRedisClient(this.redis);
    await client.set(
      toApiKeyCacheKey(keyHash),
      JSON.stringify({
        ...apiKey,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      }),
      { expiration: { type: "EX", value: this.ttlSeconds } },
    );
  }
}

function parseCachedValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
