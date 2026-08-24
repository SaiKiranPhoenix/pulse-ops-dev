import { vaultAuditEventMessageSchema, type VaultAuditEventMessage } from "@pulseops/shared";
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
  constructor(private readonly events: AuditEventRepository) {}

  async recordVaultEvent(content: unknown): Promise<AuditEventDto> {
    const message: VaultAuditEventMessage = vaultAuditEventMessageSchema.parse(content);
    const event = await this.events.createFromMessage(message);
    return toAuditEventDto(event);
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
