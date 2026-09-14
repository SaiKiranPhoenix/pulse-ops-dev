import { describe, expect, it } from "vitest";
import { OnCallService } from "../../src/services/on-call.service.js";

describe("OnCallService", () => {
  const service = new OnCallService();

  it("lists seeded default on-call schedules", async () => {
    const schedules = await service.listSchedules("default");
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    expect(schedules[0]?.name).toBe("Primary SRE On-Call Rotation");
    expect(schedules[0]?.activeOnCallUser).toBe("alice@pulseops.dev");
  });

  it("creates, updates, and deletes on-call schedules", async () => {
    const created = await service.createSchedule("default", {
      name: "Secondary Backend Rotation",
      timezone: "PST",
      activeOnCallUser: "bob@pulseops.dev",
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Secondary Backend Rotation");

    const updated = await service.updateSchedule("default", created.id, {
      activeOnCallUser: "charlie@pulseops.dev",
    });
    expect(updated?.activeOnCallUser).toBe("charlie@pulseops.dev");

    const deleted = await service.deleteSchedule("default", created.id);
    expect(deleted).toBe(true);
  });

  it("lists and manages tiered escalation policies", async () => {
    const policies = await service.listPolicies("default");
    expect(policies.length).toBeGreaterThanOrEqual(1);
    expect(policies[0]?.isDefault).toBe(true);
    expect(policies[0]?.steps.length).toBe(3);

    const created = await service.createPolicy("default", {
      name: "Critical P1 Tiered Escalation",
      steps: [
        { stepNumber: 1, delayMinutes: 0, targetType: "schedule", targetId: "sched_primary" },
        { stepNumber: 2, delayMinutes: 5, targetType: "channel", targetId: "chan_slack" },
      ],
      isDefault: false,
    });
    expect(created.steps.length).toBe(2);

    const deleted = await service.deletePolicy("default", created.id);
    expect(deleted).toBe(true);
  });
});
