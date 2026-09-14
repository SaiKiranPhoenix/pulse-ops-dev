import { describe, expect, it } from "vitest";
import { AuditService } from "../../src/services/audit.service.js";
import { MongoAuditBackend } from "../../src/services/audit-backend.service.js";
import type {
  AuditEventFilter,
  AuditEventRepository,
  SafeAuditEventRecord,
} from "../../src/repositories/audit-event.repository.js";

class CapturingAuditRepository implements AuditEventRepository {
  filter: AuditEventFilter | null = null;
  readonly events: SafeAuditEventRecord[] = [];

  async createFromMessage(): Promise<SafeAuditEventRecord> {
    throw new Error("not implemented");
  }

  async findByProject(filter: AuditEventFilter): Promise<SafeAuditEventRecord[]> {
    this.filter = filter;
    return this.events;
  }

  async findAllByProject(): Promise<SafeAuditEventRecord[]> {
    return this.events;
  }
}

describe("AuditService", () => {
  it("passes vault audit filters to the repository with parsed time bounds", async () => {
    const repository = new CapturingAuditRepository();
    const service = new AuditService(new MongoAuditBackend(repository));

    await service.list({
      projectId: "project_1",
      action: "vault.secret.reveal",
      result: "failure",
      environment: "production",
      secretKey: "DATABASE_URL",
      actor: "user_1",
      occurredAfter: "2026-08-18T00:00:00.000Z",
      occurredBefore: "2026-08-19T00:00:00.000Z",
    });

    expect(repository.filter).toEqual({
      projectId: "project_1",
      action: "vault.secret.reveal",
      result: "failure",
      environment: "production",
      secretKey: "DATABASE_URL",
      actor: "user_1",
      occurredAfter: new Date("2026-08-18T00:00:00.000Z"),
      occurredBefore: new Date("2026-08-19T00:00:00.000Z"),
    });
  });

  it("exports compliance reports and deterministic integrity hashes from the audit backend", async () => {
    const repository = new CapturingAuditRepository();
    repository.events.push(
      auditEvent("event_1", "vault.integration.fetch", "success", "integration", "token_1"),
      auditEvent("event_2", "vault.secret.reveal", "failure", "user", "user_1"),
    );
    const service = new AuditService(new MongoAuditBackend(repository, { retentionDays: 365 }));

    const exported = await service.export({ projectId: "project_1" });
    const report = await service.report({ projectId: "project_1" });
    const integrity = await service.checkIntegrity({ projectId: "project_1" });

    expect(exported.backend).toBe("mongodb");
    expect(exported.events).toHaveLength(2);
    expect(report.totals).toMatchObject({
      events: 2,
      successes: 1,
      failures: 1,
      failedReveals: 1,
      failedFetches: 0,
    });
    expect(report.secretAccessByActor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actor: "integration:token_1", fetches: 1 }),
        expect.objectContaining({ actor: "user:user_1", reveals: 1, failures: 1 }),
      ]),
    );
    expect(integrity).toMatchObject({
      backend: "mongodb",
      valid: true,
      eventCount: 2,
    });
    expect(integrity.headHash).toHaveLength(64);
  });
});

function auditEvent(
  id: string,
  action: SafeAuditEventRecord["action"],
  result: SafeAuditEventRecord["result"],
  actorType: SafeAuditEventRecord["actorType"],
  actorId: string,
): SafeAuditEventRecord {
  return {
    id,
    messageId: `message_${id}`,
    projectId: "project_1",
    actorType,
    actorId,
    action,
    result,
    environment: "production",
    secretKey: "API_TOKEN",
    tokenPrefix: actorType === "integration" ? "povt_1234" : null,
    reason: result === "failure" ? "denied" : null,
    correlationId: `request_${id}`,
    occurredAt: new Date(`2026-08-18T00:0${id.slice(-1)}:00.000Z`),
    createdAt: new Date(`2026-08-18T00:0${id.slice(-1)}:00.000Z`),
    updatedAt: new Date(`2026-08-18T00:0${id.slice(-1)}:00.000Z`),
  };
}
