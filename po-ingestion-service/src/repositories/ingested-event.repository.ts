import {
  IngestedEventModel,
  type IngestedEventDocument,
  type IngestedEventRecord,
  type IngestedEventType,
} from "../models/ingested-event.model.js";

export type CreateIngestedEventRecordInput = {
  readonly projectId: string;
  readonly type: IngestedEventType;
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly name: string | null;
  readonly value: number | null;
  readonly unit: string | null;
  readonly fingerprint: string;
  readonly attributes: Record<string, unknown>;
  readonly observedAt: Date;
  readonly idempotencyKey: string | null;
};

export type SafeIngestedEventRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly type: IngestedEventType;
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly name: string | null;
  readonly value: number | null;
  readonly unit: string | null;
  readonly fingerprint: string;
  readonly attributes: Record<string, unknown>;
  readonly observedAt: Date;
  readonly idempotencyKey: string | null;
  readonly receivedAt: Date;
  readonly createdAt: Date;
};

export interface IngestedEventRepository {
  create(input: CreateIngestedEventRecordInput): Promise<SafeIngestedEventRecord>;
  findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestedEventRecord | null>;
}

export class MongoIngestedEventRepository implements IngestedEventRepository {
  async create(input: CreateIngestedEventRecordInput): Promise<SafeIngestedEventRecord> {
    const event = await IngestedEventModel.create(input);
    return toSafeEventRecord(event);
  }

  async findByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<SafeIngestedEventRecord | null> {
    const event = await IngestedEventModel.findOne({ projectId, idempotencyKey }).exec();
    return event === null ? null : toSafeEventRecord(event);
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

function toSafeEventRecord(event: IngestedEventDocument): SafeIngestedEventRecord {
  const record = event.toObject<IngestedEventRecord>();

  return {
    id: event.id,
    projectId: record.projectId,
    type: record.type,
    source: record.source,
    level: record.level,
    message: record.message,
    name: record.name,
    value: record.value,
    unit: record.unit,
    fingerprint: record.fingerprint,
    attributes: record.attributes,
    observedAt: record.observedAt,
    idempotencyKey: record.idempotencyKey,
    receivedAt: record.receivedAt,
    createdAt: record.createdAt,
  };
}
