import { closeRedisClient, createRedisClient } from "@pulseops/shared";
import { IngestionController } from "../controllers/ingestion.controller.js";
import { INGESTION_LIMITS } from "../config/constants.js";
import { loadEnv } from "../config/env.js";
import { createTelemetryMessagePublisher } from "../events/publishers/telemetry.publisher.js";
import { RedisApiKeyValidationCacheRepository } from "../repositories/api-key-cache.repository.js";
import { MongoIngestionAcceptanceRepository } from "../repositories/ingestion-acceptance.repository.js";
import { MongoIngestionApiKeyRepository } from "../repositories/ingestion-api-key.repository.js";
import { RedisIngestionRateLimiter } from "../repositories/rate-limit.repository.js";
import { ApiKeyAuthenticatorService } from "./api-key-authenticator.service.js";
import { IngestionService } from "./ingestion.service.js";

export type IngestionServiceDependencies = {
  readonly ingestionController: IngestionController;
  readonly ingestionService: IngestionService;
  close(): Promise<void>;
};

export function createIngestionServiceDependencies(): IngestionServiceDependencies {
  const env = loadEnv();
  const redis = createRedisClient(env.REDIS_URL);
  const apiKeyAuthenticator = new ApiKeyAuthenticatorService(
    new MongoIngestionApiKeyRepository(),
    env.API_KEY_PEPPER,
    new RedisApiKeyValidationCacheRepository(redis, INGESTION_LIMITS.apiKeyCacheTtlSeconds),
  );
  const ingestionService = new IngestionService(
    apiKeyAuthenticator,
    createTelemetryMessagePublisher(env.RABBITMQ_URL),
    new MongoIngestionAcceptanceRepository(),
    new RedisIngestionRateLimiter(
      redis,
      env.RATE_LIMIT_PER_MINUTE,
      INGESTION_LIMITS.rateLimitWindowTtlSeconds,
    ),
  );

  return {
    ingestionController: new IngestionController(ingestionService),
    ingestionService,
    async close(): Promise<void> {
      await ingestionService.close();
      await closeRedisClient(redis);
    },
  };
}
