import type { IngestedEventDto } from "../services/ingestion.service.js";
import {
  IngestionAcceptanceModel,
  type IngestionAcceptanceDocument,
  type IngestionAcceptanceRecord,
} from "../models/ingestion-acceptance.model.js";

export type CreateIngestionAcceptanceInput = {
  readonly projectId: string;
  readonly idempotencyKey: string;
  readonly event: Omit<IngestedEventDto, "projectId" | "idempotentReplay">;
};

export type SafeIngestionAcceptanceRecord = {
  readonly projectId: string;
  readonly idempotencyKey: string;
  readonly event: Omit<IngestedEventDto, "projectId" | "idempotentReplay">;
  readonly createdAt: Date;
};

export interface IngestionAcceptanceRepository {
  create(input: CreateIngestionAcceptanceInput): Promise<SafeIngestionAcceptanceRecord>;
  findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestionAcceptanceRecord | null>;
}

export class MongoIngestionAcceptanceRepository implements IngestionAcceptanceRepository {
  async create(input: CreateIngestionAcceptanceInput): Promise<SafeIngestionAcceptanceRecord> {
    const acceptance = await IngestionAcceptanceModel.create(input);
    return toSafeAcceptanceRecord(acceptance);
  }

  async findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestionAcceptanceRecord | null> {
    const acceptance = await IngestionAcceptanceModel.findOne({ projectId, idempotencyKey }).exec();
    return acceptance === null ? null : toSafeAcceptanceRecord(acceptance);
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === 11000
  );
}

function toSafeAcceptanceRecord(
  acceptance: IngestionAcceptanceDocument,
): SafeIngestionAcceptanceRecord {
  const record = acceptance.toObject<IngestionAcceptanceRecord>();

  return {
    projectId: record.projectId,
    idempotencyKey: record.idempotencyKey,
    event: {
      id: record.event.id,
      type: record.event.type,
      source: record.event.source,
      fingerprint: record.event.fingerprint,
      observedAt: record.event.observedAt,
      receivedAt: record.event.receivedAt,
    },
    createdAt: record.createdAt,
  };
}
