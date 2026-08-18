import { createHash } from "node:crypto";
import type { IngestedEventType } from "../models/ingested-event.model.js";
import {
  isDuplicateKeyError,
  type IngestedEventRepository,
  type SafeIngestedEventRecord,
} from "../repositories/ingested-event.repository.js";
import type { ApiKeyAuthenticatorService } from "./api-key-authenticator.service.js";

export type IngestionEventInput = {
  readonly rawApiKey: string;
  readonly idempotencyKey: string | null;
  readonly type: IngestedEventType;
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
  readonly type: IngestedEventType;
  readonly source: string;
  readonly fingerprint: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly idempotentReplay: boolean;
};

const scopeByType: Record<IngestedEventType, string> = {
  log: "logs:write",
  error: "errors:write",
  metric: "metrics:write",
};

export class IngestionService {
  constructor(
    private readonly apiKeyAuthenticator: ApiKeyAuthenticatorService,
    private readonly events: IngestedEventRepository,
  ) {}

  async ingest(input: IngestionEventInput): Promise<IngestedEventDto> {
    const apiKey = await this.apiKeyAuthenticator.authenticate(
      input.rawApiKey,
      scopeByType[input.type],
    );

    if (input.idempotencyKey !== null) {
      const existingEvent = await this.events.findByIdempotencyKey(
        apiKey.projectId,
        input.idempotencyKey,
      );

      if (existingEvent !== null) {
        return toEventDto(existingEvent, true);
      }
    }

    try {
      const event = await this.events.create({
        projectId: apiKey.projectId,
        type: input.type,
        source: input.source,
        level: input.level ?? null,
        message: input.message ?? null,
        name: input.name ?? null,
        value: input.value ?? null,
        unit: input.unit ?? null,
        fingerprint: input.fingerprint ?? createFingerprint(input),
        attributes: input.attributes ?? {},
        observedAt: input.timestamp ?? new Date(),
        idempotencyKey: input.idempotencyKey,
      });

      return toEventDto(event, false);
    } catch (error) {
      if (input.idempotencyKey !== null && isDuplicateKeyError(error)) {
        const existingEvent = await this.events.findByIdempotencyKey(
          apiKey.projectId,
          input.idempotencyKey,
        );

        if (existingEvent !== null) {
          return toEventDto(existingEvent, true);
        }
      }

      throw error;
    }
  }
}

function createFingerprint(input: IngestionEventInput): string {
  return createHash("sha256")
    .update([input.type, input.source, input.name, input.message, input.level].join("|"))
    .digest("base64url");
}

function toEventDto(event: SafeIngestedEventRecord, idempotentReplay: boolean): IngestedEventDto {
  return {
    id: event.id,
    projectId: event.projectId,
    type: event.type,
    source: event.source,
    fingerprint: event.fingerprint,
    observedAt: event.observedAt.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
    idempotentReplay,
  };
}
