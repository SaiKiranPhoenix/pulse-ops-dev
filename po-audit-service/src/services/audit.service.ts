import { vaultAuditEventMessageSchema, type VaultAuditEventMessage } from "@pulseops/shared";
import {
  noopRealtimeVaultAuditPublisher,
  type RealtimeVaultAuditPublisher,
} from "../events/publishers/realtime-vault-audit.publisher.js";
import type {
  AuditEventFilter,
  AuditEventRepository,
  SafeAuditEventRecord,
} from "../repositories/audit-event.repository.js";

export type AuditEventDto = Omit<SafeAuditEventRecord, "occurredAt" | "createdAt" | "updatedAt"> & {
  readonly occurredAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AuditListFilter = Omit<AuditEventFilter, "occurredAfter" | "occurredBefore"> & {
  readonly occurredAfter?: string | undefined;
  readonly occurredBefore?: string | undefined;
};

export class AuditService {
  constructor(
    private readonly events: AuditEventRepository,
    private readonly realtimeAudit: RealtimeVaultAuditPublisher = noopRealtimeVaultAuditPublisher,
  ) {}

  async recordVaultEvent(content: unknown): Promise<AuditEventDto> {
    const message: VaultAuditEventMessage = vaultAuditEventMessageSchema.parse(content);
    const event = await this.events.createFromMessage(message);
    const eventDto = toAuditEventDto(event);

    try {
      await this.realtimeAudit.publish({
        messageId: `vault-audit:${event.id}:${event.updatedAt.getTime()}`,
        schemaVersion: 1,
        projectId: event.projectId,
        auditEvent: eventDto,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Durable audit storage is the product guarantee; realtime delivery is best-effort.
    }

    return eventDto;
  }

  async list(filter: AuditListFilter): Promise<AuditEventDto[]> {
    const events = await this.events.findByProject({
      ...filter,
      occurredAfter:
        filter.occurredAfter === undefined ? undefined : new Date(filter.occurredAfter),
      occurredBefore:
        filter.occurredBefore === undefined ? undefined : new Date(filter.occurredBefore),
    });
    return events.map(toAuditEventDto);
  }
}

function toAuditEventDto(event: SafeAuditEventRecord): AuditEventDto {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
