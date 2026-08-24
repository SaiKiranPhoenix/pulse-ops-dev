import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { TELEMETRY_ROUTING_KEYS, type TelemetryEventType } from "@pulseops/shared";
import type { TelemetryMessagePublisher } from "../events/publishers/telemetry.publisher.js";
import {
  isDuplicateKeyError,
  type IngestionAcceptanceRepository,
} from "../repositories/ingestion-acceptance.repository.js";
import type { ApiKeyAuthenticatorService } from "./api-key-authenticator.service.js";

export type IngestionEventInput = {
  readonly rawApiKey: string;
  readonly idempotencyKey: string | null;
  readonly type: TelemetryEventType;
  readonly source: string;
  readonly level?: string | undefined;
  readonly message?: string | undefined;
  readonly name?: string | undefined;
  readonly value?: number | undefined;
  readonly unit?: string | undefined;
  readonly fingerprint?: string | undefined;
  readonly attributes?: Record<string, unknown> | undefined;
  readonly timestamp?: Date | undefined;
};

export type IngestedEventDto = {
  readonly id: string;
  readonly projectId: string;
  readonly type: TelemetryEventType;
  readonly source: string;
  readonly fingerprint: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly idempotentReplay: boolean;
};

const scopeByType: Record<TelemetryEventType, string> = {
  log: "logs:write",
  error: "errors:write",
  metric: "metrics:write",
};

export class IngestionService {
  constructor(
    private readonly apiKeyAuthenticator: ApiKeyAuthenticatorService,
    private readonly publisher: TelemetryMessagePublisher,
    private readonly acceptances: IngestionAcceptanceRepository,
  ) {}

  async ingest(input: IngestionEventInput): Promise<IngestedEventDto> {
    const apiKey = await this.apiKeyAuthenticator.authenticate(
      input.rawApiKey,
      scopeByType[input.type],
    );

    if (input.idempotencyKey !== null) {
      const existingAcceptance = await this.acceptances.findByIdempotencyKey(
        apiKey.projectId,
        input.idempotencyKey,
      );

      if (existingAcceptance !== null) {
        return toEventDto(apiKey.projectId, existingAcceptance.event, true);
      }
    }

    const acceptedAt = new Date();
    const observedAt = input.timestamp ?? acceptedAt;
    const fingerprint = input.fingerprint ?? createFingerprint(input);
    const messageId = `ing_${randomUUID()}`;

    await this.publisher.publish(TELEMETRY_ROUTING_KEYS[input.type], {
      messageId,
      schemaVersion: 1,
      type: input.type,
      projectId: apiKey.projectId,
      ownerId: apiKey.ownerId,
      correlationId: messageId,
      idempotencyKey: input.idempotencyKey,
      source: input.source,
      level: input.level ?? null,
      message: input.message ?? null,
      name: input.name ?? null,
      value: input.value ?? null,
      unit: input.unit ?? null,
      fingerprint,
      attributes: input.attributes ?? {},
      observedAt: observedAt.toISOString(),
      acceptedAt: acceptedAt.toISOString(),
    });

    const acceptedEvent = {
      id: messageId,
      type: input.type,
      source: input.source,
      fingerprint,
      observedAt: observedAt.toISOString(),
      receivedAt: acceptedAt.toISOString(),
    };

    if (input.idempotencyKey !== null) {
      try {
        await this.acceptances.create({
          projectId: apiKey.projectId,
          idempotencyKey: input.idempotencyKey,
          event: acceptedEvent,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          const existingAcceptance = await this.acceptances.findByIdempotencyKey(
            apiKey.projectId,
            input.idempotencyKey,
          );

          if (existingAcceptance !== null) {
            return toEventDto(apiKey.projectId, existingAcceptance.event, true);
          }
        }

        throw error;
      }
    }

    return toEventDto(apiKey.projectId, acceptedEvent, false);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

function createFingerprint(input: IngestionEventInput): string {
  return createHash("sha256")
    .update([input.type, input.source, input.name, input.message, input.level].join("|"))
    .digest("base64url");
}

function toEventDto(
  projectId: string,
  event: Omit<IngestedEventDto, "projectId" | "idempotentReplay">,
  idempotentReplay: boolean,
): IngestedEventDto {
  return {
    ...event,
    projectId,
    idempotentReplay,
  };
}

