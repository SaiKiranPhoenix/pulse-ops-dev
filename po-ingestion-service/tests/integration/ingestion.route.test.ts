import { createHmac } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { IngestionController } from "../../src/controllers/ingestion.controller.js";
import type {
  IngestionApiKeyRepository,
  VerifiedIngestionApiKey,
} from "../../src/repositories/ingestion-api-key.repository.js";
import type {
  CreateIngestedEventRecordInput,
  IngestedEventRepository,
  SafeIngestedEventRecord,
} from "../../src/repositories/ingested-event.repository.js";
import { ApiKeyAuthenticatorService } from "../../src/services/api-key-authenticator.service.js";
import type { IngestionServiceDependencies } from "../../src/services/dependencies.js";
import { IngestionService } from "../../src/services/ingestion.service.js";

const fixedDate = new Date("2026-08-18T00:00:00.000Z");

class InMemoryApiKeyRepository implements IngestionApiKeyRepository {
  constructor(private readonly apiKeys: Map<string, VerifiedIngestionApiKey>) {}

  async findActiveByHash(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    return this.apiKeys.get(keyHash) ?? null;
  }
}

class InMemoryEventRepository implements IngestedEventRepository {
  private readonly events = new Map<string, SafeIngestedEventRecord>();

  async create(input: CreateIngestedEventRecordInput): Promise<SafeIngestedEventRecord> {
    const event: SafeIngestedEventRecord = {
      id: `evt_${this.events.size + 1}`,
      projectId: input.projectId,
      type: input.type,
      source: input.source,
      level: input.level,
      message: input.message,
      name: input.name,
      value: input.value,
      unit: input.unit,
      fingerprint: input.fingerprint,
      attributes: input.attributes,
      observedAt: input.observedAt,
      idempotencyKey: input.idempotencyKey,
      receivedAt: fixedDate,
      createdAt: fixedDate,
    };

    if (input.idempotencyKey !== null) {
      this.events.set(`${input.projectId}:${input.idempotencyKey}`, event);
    }

    return event;
  }

  async findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestedEventRecord | null> {
    return this.events.get(`${projectId}:${idempotencyKey}`) ?? null;
  }
}

describe("ingestion routes", () => {
  it("accepts authenticated logs and replays idempotent requests", async () => {
    const app = createApp({ dependencies: createTestDependencies() });

    const firstResponse = await request(app)
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

    expect(firstResponse.body.data.event).toMatchObject({
      id: "evt_1",
      projectId: "project_1",
      type: "log",
      source: "checkout-api",
      idempotentReplay: false,
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
      id: "evt_1",
      idempotentReplay: true,
    });
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
});

function createTestDependencies(): IngestionServiceDependencies {
  const apiKeys = new Map<string, VerifiedIngestionApiKey>();
  apiKeys.set(hashApiKey(validApiKey()), {
    projectId: "project_1",
    ownerId: "owner_1",
    scopes: ["logs:write", "errors:write", "metrics:write"],
    status: "active",
    expiresAt: null,
  });

  const ingestionService = new IngestionService(
    new ApiKeyAuthenticatorService(new InMemoryApiKeyRepository(apiKeys), validApiKeyPepper()),
    new InMemoryEventRepository(),
  );

  return {
    ingestionController: new IngestionController(ingestionService),
    ingestionService,
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
