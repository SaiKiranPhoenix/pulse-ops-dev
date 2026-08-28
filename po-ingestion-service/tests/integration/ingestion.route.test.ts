import { createHmac } from "node:crypto";
import type { TelemetryEventMessage } from "@pulseops/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { IngestionController } from "../../src/controllers/ingestion.controller.js";
import type {
  IngestionApiKeyRepository,
  VerifiedIngestionApiKey,
} from "../../src/repositories/ingestion-api-key.repository.js";
import type { ApiKeyValidationCacheRepository } from "../../src/repositories/api-key-cache.repository.js";
import type { TelemetryMessagePublisher } from "../../src/events/publishers/telemetry.publisher.js";
import type {
  CreateIngestionAcceptanceInput,
  IngestionAcceptanceRepository,
  SafeIngestionAcceptanceRecord,
} from "../../src/repositories/ingestion-acceptance.repository.js";
import type {
  IngestionRateLimiter,
  RateLimitDecision,
} from "../../src/repositories/rate-limit.repository.js";
import { ApiKeyAuthenticatorService } from "../../src/services/api-key-authenticator.service.js";
import type { IngestionServiceDependencies } from "../../src/services/dependencies.js";
import { IngestionService } from "../../src/services/ingestion.service.js";

class InMemoryApiKeyRepository implements IngestionApiKeyRepository {
  lookupCount = 0;

  constructor(private readonly apiKeys: Map<string, VerifiedIngestionApiKey>) {}

  async findActiveByHash(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    this.lookupCount += 1;
    return this.apiKeys.get(keyHash) ?? null;
  }
}

class InMemoryApiKeyCache implements ApiKeyValidationCacheRepository {
  private readonly apiKeys = new Map<string, VerifiedIngestionApiKey>();

  async get(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    return this.apiKeys.get(keyHash) ?? null;
  }

  async set(keyHash: string, apiKey: VerifiedIngestionApiKey): Promise<void> {
    this.apiKeys.set(keyHash, apiKey);
  }
}

class FailingApiKeyCache implements ApiKeyValidationCacheRepository {
  async get(): Promise<VerifiedIngestionApiKey | null> {
    throw new Error("redis get failed");
  }

  async set(): Promise<void> {
    throw new Error("redis set failed");
  }
}

class InMemoryTelemetryPublisher implements TelemetryMessagePublisher {
  readonly published: Array<{ routingKey: string; message: TelemetryEventMessage }> = [];

  async publish(routingKey: string, message: TelemetryEventMessage): Promise<void> {
    this.published.push({ routingKey, message });
  }

  async close(): Promise<void> {
    this.published.length = 0;
  }
}

class InMemoryAcceptanceRepository implements IngestionAcceptanceRepository {
  private readonly acceptances = new Map<string, SafeIngestionAcceptanceRecord>();

  async create(input: CreateIngestionAcceptanceInput): Promise<SafeIngestionAcceptanceRecord> {
    const acceptance: SafeIngestionAcceptanceRecord = {
      projectId: input.projectId,
      idempotencyKey: input.idempotencyKey,
      event: input.event,
      createdAt: new Date("2026-08-18T00:00:00.000Z"),
    };
    this.acceptances.set(toAcceptanceKey(input.projectId, input.idempotencyKey), acceptance);
    return acceptance;
  }

  async findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestionAcceptanceRecord | null> {
    return this.acceptances.get(toAcceptanceKey(projectId, idempotencyKey)) ?? null;
  }
}

class InMemoryRateLimiter implements IngestionRateLimiter {
  consumeCount = 0;

  constructor(private readonly limit = 600) {}

  async consume(_projectId: string): Promise<RateLimitDecision> {
    this.consumeCount += 1;

    return {
      allowed: this.consumeCount <= this.limit,
      limit: this.limit,
      remaining: Math.max(this.limit - this.consumeCount, 0),
      retryAfterSeconds: 60,
    };
  }
}

class FailingRateLimiter implements IngestionRateLimiter {
  async consume(): Promise<RateLimitDecision> {
    throw new Error("redis unavailable");
  }
}

describe("ingestion routes", () => {
  it("accepts authenticated logs after publishing to RabbitMQ and replays idempotent requests", async () => {
    const dependencies = createTestDependencies();
    const app = createApp({ dependencies });

    const response = await request(app)
      .post("/ingest/logs")
      .set("x-api-key", validApiKey())
      .set("idempotency-key", "idem_log_1")
      .set("x-request-id", "req_ingest")
      .send({
        source: "checkout-api",
        level: "error",
        message: "Payment provider timeout",
      })
      .expect(202);

    expect(response.body.data.event).toMatchObject({
      projectId: "project_1",
      type: "log",
      source: "checkout-api",
      idempotentReplay: false,
    });
    expect(dependencies.publisher.published).toHaveLength(1);
    expect(dependencies.publisher.published[0]).toMatchObject({
      routingKey: "telemetry.log.v1",
      message: {
        projectId: "project_1",
        ownerId: "owner_1",
        type: "log",
        source: "checkout-api",
        level: "error",
        message: "Payment provider timeout",
        idempotencyKey: "idem_log_1",
      },
    });

    const replayResponse = await request(app)
      .post("/ingest/logs")
      .set("x-api-key", validApiKey())
      .set("idempotency-key", "idem_log_1")
      .send({
        source: "checkout-api",
        level: "error",
        message: "Payment provider timeout",
      })
      .expect(202);

    expect(replayResponse.body.data.event).toMatchObject({
      id: response.body.data.event.id,
      idempotentReplay: true,
    });
    expect(dependencies.publisher.published).toHaveLength(1);
    expect((dependencies.rateLimiter as InMemoryRateLimiter).consumeCount).toBe(1);
    expect(dependencies.apiKeys.lookupCount).toBe(1);
  });

  it("rejects requests without an API key", async () => {
    const app = createApp({ dependencies: createTestDependencies() });

    const response = await request(app)
      .post("/ingest/metrics")
      .set("x-request-id", "req_missing_key")
      .send({
        source: "checkout-api",
        name: "checkout_latency_ms",
        value: 42,
      })
      .expect(401);

    expect(response.body).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "API key is required",
      },
      requestId: "req_missing_key",
    });
  });

  it("accepts valid ingestion when the API key cache is unavailable", async () => {
    const dependencies = createTestDependencies({ cache: new FailingApiKeyCache() });
    const app = createApp({ dependencies });

    await request(app)
      .post("/ingest/logs")
      .set("x-api-key", validApiKey())
      .send({
        source: "checkout-api",
        level: "info",
        message: "Redis cache outage should not block validation fallback",
      })
      .expect(202);

    expect(dependencies.apiKeys.lookupCount).toBe(1);
    expect(dependencies.publisher.published).toHaveLength(1);
  });

  it("fails closed when the Redis-backed rate limiter is unavailable", async () => {
    const dependencies = createTestDependencies({ rateLimiter: new FailingRateLimiter() });
    const app = createApp({ dependencies });

    const response = await request(app)
      .post("/ingest/logs")
      .set("x-api-key", validApiKey())
      .set("x-request-id", "req_redis_down")
      .send({
        source: "checkout-api",
        level: "info",
        message: "Redis rate limiter unavailable",
      })
      .expect(503);

    expect(response.body).toMatchObject({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Rate limiter unavailable",
      },
      requestId: "req_redis_down",
    });
    expect(dependencies.publisher.published).toHaveLength(0);
  });

  it("rate limits new accepted events per project", async () => {
    const dependencies = createTestDependencies({ rateLimit: 1 });
    const app = createApp({ dependencies });

    await request(app)
      .post("/ingest/metrics")
      .set("x-api-key", validApiKey())
      .send({
        source: "checkout-api",
        name: "checkout_latency_ms",
        value: 42,
      })
      .expect(202);

    const response = await request(app)
      .post("/ingest/metrics")
      .set("x-api-key", validApiKey())
      .set("x-request-id", "req_rate_limited")
      .send({
        source: "checkout-api",
        name: "checkout_latency_ms",
        value: 84,
      })
      .expect(429);

    expect(response.body).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Ingestion rate limit exceeded",
        details: {
          limit: 1,
          remaining: 0,
          retryAfterSeconds: 60,
        },
      },
      requestId: "req_rate_limited",
    });
    expect(dependencies.publisher.published).toHaveLength(1);
  });
});

function createTestDependencies(
  options: {
    readonly cache?: ApiKeyValidationCacheRepository;
    readonly rateLimit?: number;
    readonly rateLimiter?: IngestionRateLimiter;
  } = {},
): IngestionServiceDependencies & {
  readonly apiKeys: InMemoryApiKeyRepository;
  readonly publisher: InMemoryTelemetryPublisher;
  readonly rateLimiter: IngestionRateLimiter;
} {
  const apiKeys = new Map<string, VerifiedIngestionApiKey>();
  apiKeys.set(hashApiKey(validApiKey()), {
    projectId: "project_1",
    ownerId: "owner_1",
    scopes: ["logs:write", "errors:write", "metrics:write"],
    status: "active",
    expiresAt: null,
  });
  const apiKeyRepository = new InMemoryApiKeyRepository(apiKeys);
  const publisher = new InMemoryTelemetryPublisher();
  const rateLimiter = options.rateLimiter ?? new InMemoryRateLimiter(options.rateLimit);

  const ingestionService = new IngestionService(
    new ApiKeyAuthenticatorService(
      apiKeyRepository,
      validApiKeyPepper(),
      options.cache ?? new InMemoryApiKeyCache(),
    ),
    publisher,
    new InMemoryAcceptanceRepository(),
    rateLimiter,
  );

  return {
    ingestionController: new IngestionController(ingestionService),
    ingestionService,
    async close(): Promise<void> {
      await ingestionService.close();
    },
    apiKeys: apiKeyRepository,
    publisher,
    rateLimiter,
  };
}

function validApiKey(): string {
  return ["po", "live", "local", "ingestion", "test", "key"].join("_");
}

function validApiKeyPepper(): string {
  return ["local", "test", "api", "key", "pepper", "minimum", "length"].join("-");
}

function hashApiKey(value: string): string {
  return createHmac("sha256", validApiKeyPepper()).update(value).digest("base64url");
}

function toAcceptanceKey(projectId: string, idempotencyKey: string): string {
  return `${projectId}:${idempotencyKey}`;
}
