import { describe, expect, it } from "vitest";

import { AuditEventModel } from "../../src/models/audit-event.model.js";

describe("AuditEventModel indexes", () => {
  it("declares indexes for audit list, environment, action, actor, and secret queries", () => {
    expect(AuditEventModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, occurredAt: -1 },
          expect.objectContaining({ name: "idx_audit_events_project_occurred" }),
        ],
        [
          { projectId: 1, environment: 1, occurredAt: -1 },
          expect.objectContaining({ name: "idx_audit_events_project_env_occurred" }),
        ],
        [
          { projectId: 1, action: 1, result: 1, occurredAt: -1 },
          expect.objectContaining({ name: "idx_audit_events_project_action_result_occurred" }),
        ],
        [
          { projectId: 1, actorType: 1, actorId: 1, occurredAt: -1 },
          expect.objectContaining({ name: "idx_audit_events_project_actor_occurred" }),
        ],
        [
          { projectId: 1, secretKey: 1, occurredAt: -1 },
          expect.objectContaining({ name: "idx_audit_events_project_secret_occurred" }),
        ],
      ]),
    );
  });
});
