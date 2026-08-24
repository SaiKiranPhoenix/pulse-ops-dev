import type { TelemetryEventMessage } from "@pulseops/shared";
import { EventModel, type EventDocument, type EventRecord } from "../models/event.model.js";

export type SafeEventRecord = {
  readonly id: string;
  readonly messageId: string;
  readonly projectId: string;
  readonly type: EventRecord["type"];
  readonly source: string;
  readonly fingerprint: string;
  readonly receivedAt: Date;
  readonly processedAt: Date;
};

export interface EventRepository {
  createFromTelemetry(message: TelemetryEventMessage): Promise<SafeEventRecord>;
  findByMessageId(messageId: string): Promise<SafeEventRecord | null>;
}

export class MongoEventRepository implements EventRepository {
  async createFromTelemetry(message: TelemetryEventMessage): Promise<SafeEventRecord> {
    const existingEvent = await this.findByMessageId(message.messageId);

    if (existingEvent !== null) {
      return existingEvent;
    }

    try {
      const event = await EventModel.create({
        messageId: message.messageId,
        projectId: message.projectId,
        ownerId: message.ownerId,
        type: message.type,
        source: message.source,
        level: message.level,
        message: message.message,
        name: message.name,
        value: message.value,
        unit: message.unit,
        fingerprint: message.fingerprint,
        attributes: message.attributes,
        observedAt: new Date(message.observedAt),
        idempotencyKey: message.idempotencyKey,
        receivedAt: new Date(message.acceptedAt),
        processedAt: new Date(),
      });
      return toSafeEventRecord(event);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existingEventAfterRace = await this.findByMessageId(message.messageId);

        if (existingEventAfterRace !== null) {
          return existingEventAfterRace;
        }
      }

      throw error;
    }
  }

  async findByMessageId(messageId: string): Promise<SafeEventRecord | null> {
    const event = await EventModel.findOne({ messageId }).exec();
    return event === null ? null : toSafeEventRecord(event);
  }
}

function toSafeEventRecord(event: EventDocument): SafeEventRecord {
  const record = event.toObject<EventRecord>();

  return {
    id: event.id,
    messageId: record.messageId,
    projectId: record.projectId,
    type: record.type,
    source: record.source,
    fingerprint: record.fingerprint,
    receivedAt: record.receivedAt,
    processedAt: record.processedAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === 11000
  );
}
