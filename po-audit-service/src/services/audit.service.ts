import { vaultAuditEventMessageSchema, type VaultAuditEventMessage } from "@pulseops/shared";
import {
  noopRealtimeVaultAuditPublisher,
  type RealtimeVaultAuditPublisher,
} from "../events/publishers/realtime-vault-audit.publisher.js";
import type {
  AuditEventRepository,
  SafeAuditEventRecord,
} from "../repositories/audit-event.repository.js";

export type AuditEventDto = Omit<SafeAuditEventRecord, "occurredAt" | "createdAt" | "updatedAt"> & {
  readonly occurredAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
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

  async list(projectId: string): Promise<AuditEventDto[]> {
    const events = await this.events.findByProject(projectId);
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
