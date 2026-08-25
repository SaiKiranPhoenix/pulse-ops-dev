import type { VaultAuditEventMessage } from "@pulseops/shared";
import {
  AuditEventModel,
  type AuditEventDocument,
  type AuditEventRecord,
} from "../models/audit-event.model.js";

export type SafeAuditEventRecord = AuditEventRecord & {
  readonly id: string;
};

export interface AuditEventRepository {
  createFromMessage(message: VaultAuditEventMessage): Promise<SafeAuditEventRecord>;
  findByProject(projectId: string): Promise<SafeAuditEventRecord[]>;
}

export class MongoAuditEventRepository implements AuditEventRepository {
  async createFromMessage(message: VaultAuditEventMessage): Promise<SafeAuditEventRecord> {
    const existingEvent = await AuditEventModel.findOne({ messageId: message.messageId }).exec();

    if (existingEvent !== null) {
      return toSafeAuditEventRecord(existingEvent);
    }

    try {
      const event = await AuditEventModel.create({
        messageId: message.messageId,
        projectId: message.projectId,
        actorType: message.actorType,
        actorId: message.actorId,
        action: message.action,
        result: message.result,
        environment: message.environment,
        secretKey: message.secretKey,
        tokenPrefix: message.tokenPrefix,
        reason: message.reason,
        correlationId: message.correlationId,
        occurredAt: new Date(message.occurredAt),
      });
      return toSafeAuditEventRecord(event);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const eventAfterRace = await AuditEventModel.findOne({
          messageId: message.messageId,
        }).exec();

        if (eventAfterRace !== null) {
          return toSafeAuditEventRecord(eventAfterRace);
        }
      }

      throw error;
    }
  }

  async findByProject(projectId: string): Promise<SafeAuditEventRecord[]> {
    const events = await AuditEventModel.find({ projectId })
      .sort({ occurredAt: -1 })
      .limit(100)
      .exec();
    return events.map(toSafeAuditEventRecord);
  }
}

function toSafeAuditEventRecord(event: AuditEventDocument): SafeAuditEventRecord {
  return {
    id: event.id,
    messageId: event.messageId,
    projectId: event.projectId,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    result: event.result,
    environment: event.environment,
    secretKey: event.secretKey,
    tokenPrefix: event.tokenPrefix,
    reason: event.reason,
    correlationId: event.correlationId,
    occurredAt: event.occurredAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
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
