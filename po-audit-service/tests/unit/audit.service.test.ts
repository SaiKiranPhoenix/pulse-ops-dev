import { describe, expect, it } from "vitest";
import { AuditService } from "../../src/services/audit.service.js";
import type {
  AuditEventFilter,
  AuditEventRepository,
  SafeAuditEventRecord,
} from "../../src/repositories/audit-event.repository.js";

class CapturingAuditRepository implements AuditEventRepository {
  filter: AuditEventFilter | null = null;

  async createFromMessage(): Promise<SafeAuditEventRecord> {
    throw new Error("not implemented");
  }

  async findByProject(filter: AuditEventFilter): Promise<SafeAuditEventRecord[]> {
    this.filter = filter;
    return [];
  }
}

describe("AuditService", () => {
  it("passes vault audit filters to the repository with parsed time bounds", async () => {
    const repository = new CapturingAuditRepository();
    const service = new AuditService(repository);

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
});
