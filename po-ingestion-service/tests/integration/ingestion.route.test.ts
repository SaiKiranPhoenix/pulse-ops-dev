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
import type { TelemetryMessagePublisher } from "../../src/events/publishers/telemetry.publisher.js";
import type {
  CreateIngestionAcceptanceInput,
  IngestionAcceptanceRepository,
  SafeIngestionAcceptanceRecord,
} from "../../src/repositories/ingestion-acceptance.repository.js";
import { ApiKeyAuthenticatorService } from "../../src/services/api-key-authenticator.service.js";
import type { IngestionServiceDependencies } from "../../src/services/dependencies.js";
import { IngestionService } from "../../src/services/ingestion.service.js";

class InMemoryApiKeyRepository implements IngestionApiKeyRepository {
  constructor(private readonly apiKeys: Map<string, VerifiedIngestionApiKey>) {}

  async findActiveByHash(keyHash: string): Promise<VerifiedIngestionApiKey | null> {
    return this.apiKeys.get(keyHash) ?? null;
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

function createTestDependencies(): IngestionServiceDependencies & {
  readonly publisher: InMemoryTelemetryPublisher;
} {
  const apiKeys = new Map<string, VerifiedIngestionApiKey>();
  apiKeys.set(hashApiKey(validApiKey()), {
    projectId: "project_1",
    ownerId: "owner_1",
    scopes: ["logs:write", "errors:write", "metrics:write"],
    status: "active",
    expiresAt: null,
  });
  const publisher = new InMemoryTelemetryPublisher();

  const ingestionService = new IngestionService(
    new ApiKeyAuthenticatorService(new InMemoryApiKeyRepository(apiKeys), validApiKeyPepper()),
    publisher,
    new InMemoryAcceptanceRepository(),
  );

  return {
    ingestionController: new IngestionController(ingestionService),
    ingestionService,
    publisher,
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
