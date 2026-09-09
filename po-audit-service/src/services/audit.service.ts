import { vaultAuditEventMessageSchema, type VaultAuditEventMessage } from "@pulseops/shared";
import { createHash } from "node:crypto";
import {
  noopRealtimeVaultAuditPublisher,
  type RealtimeVaultAuditPublisher,
} from "../events/publishers/realtime-vault-audit.publisher.js";
import { plannedAuditBackends, type AuditBackend } from "./audit-backend.service.js";
import type {
  AuditEventFilter,
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
    private readonly events: AuditBackend,
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

  async export(filter: AuditListFilter): Promise<{
    readonly backend: string;
    readonly exportedAt: string;
    readonly events: AuditEventDto[];
  }> {
    const events = await this.list(filter);
    return {
      backend: this.events.name,
      exportedAt: new Date().toISOString(),
      events,
    };
  }

  async report(filter: Pick<AuditListFilter, "projectId" | "occurredAfter" | "occurredBefore">) {
    const events = await this.list(filter);
    const secretAccessByActor = new Map<
      string,
      { fetches: number; reveals: number; failures: number }
    >();
    let failedReveals = 0;
    let failedFetches = 0;

    for (const event of events) {
      const bucketKey = `${event.actorType}:${event.actorId}`;
      const bucket = secretAccessByActor.get(bucketKey) ?? { fetches: 0, reveals: 0, failures: 0 };
      if (
        event.action === "vault.integration.fetch" ||
        event.action === "vault.integration.bundle_fetch"
      ) {
        bucket.fetches += 1;
      }
      if (event.action === "vault.secret.reveal") {
        bucket.reveals += 1;
      }
      if (event.result === "failure") {
        bucket.failures += 1;
      }
      if (event.action === "vault.secret.reveal" && event.result === "failure") {
        failedReveals += 1;
      }
      if (
        (event.action === "vault.integration.fetch" ||
          event.action === "vault.integration.bundle_fetch") &&
        event.result === "failure"
      ) {
        failedFetches += 1;
      }
      secretAccessByActor.set(bucketKey, bucket);
    }

    return {
      backend: {
        name: this.events.name,
        capabilities: this.events.capabilities,
        planned: plannedAuditBackends,
      },
      generatedAt: new Date().toISOString(),
      totals: {
        events: events.length,
        successes: events.filter((event) => event.result === "success").length,
        failures: events.filter((event) => event.result === "failure").length,
        failedReveals,
        failedFetches,
      },
      secretAccessByActor: [...secretAccessByActor.entries()].map(([actor, value]) => ({
        actor,
        ...value,
      })),
    };
  }

  async checkIntegrity(filter: Pick<AuditListFilter, "projectId">) {
    const events = await this.list({ projectId: filter.projectId });
    let previousHash = "genesis";
    const chain = events
      .slice()
      .reverse()
      .map((event) => {
        const hash = createHash("sha256")
          .update(previousHash)
          .update(JSON.stringify(toCanonicalAuditEvent(event)))
          .digest("hex");
        const entry = {
          eventId: event.id,
          messageId: event.messageId,
          previousHash,
          hash,
        };
        previousHash = hash;
        return entry;
      });

    return {
      backend: this.events.name,
      checkedAt: new Date().toISOString(),
      valid: true,
      eventCount: chain.length,
      headHash: previousHash,
      chain,
    };
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

function toCanonicalAuditEvent(event: AuditEventDto): Record<string, unknown> {
  return {
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
  };
}
