import type {
  CreateEscalationPolicyInput,
  CreateOnCallScheduleInput,
  EscalationPolicy,
  OnCallSchedule,
} from "@pulseops/shared";

export class OnCallService {
  private readonly schedulesStore = new Map<string, OnCallSchedule>();
  private readonly policiesStore = new Map<string, EscalationPolicy>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();

    const defaultSchedule: OnCallSchedule = {
      id: "sched_primary_sre",
      projectId: "default",
      name: "Primary SRE On-Call Rotation",
      timezone: "UTC",
      rotations: [
        {
          id: "rot_weekly_primary",
          name: "Weekly Primary",
          type: "weekly",
          participants: ["alice@pulseops.dev", "bob@pulseops.dev", "charlie@pulseops.dev"],
          activeParticipant: "alice@pulseops.dev",
          shiftStart: now,
        },
      ],
      activeOnCallUser: "alice@pulseops.dev",
      createdAt: now,
      updatedAt: now,
    };

    this.schedulesStore.set(defaultSchedule.id, defaultSchedule);

    const defaultPolicy: EscalationPolicy = {
      id: "policy_default_escalation",
      projectId: "default",
      name: "Default Critical Incident Escalation",
      isDefault: true,
      steps: [
        {
          stepNumber: 1,
          delayMinutes: 0,
          targetType: "schedule",
          targetId: defaultSchedule.id,
        },
        {
          stepNumber: 2,
          delayMinutes: 5,
          targetType: "channel",
          targetId: "chan_slack_critical",
        },
        {
          stepNumber: 3,
          delayMinutes: 15,
          targetType: "user",
          targetId: "sre-manager@pulseops.dev",
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.policiesStore.set(defaultPolicy.id, defaultPolicy);
  }

  // On-Call Schedules
  async listSchedules(projectId: string): Promise<OnCallSchedule[]> {
    return Array.from(this.schedulesStore.values()).filter(
      (s) => s.projectId === projectId || s.projectId === "default",
    );
  }

  async findScheduleById(projectId: string, id: string): Promise<OnCallSchedule | null> {
    const found = this.schedulesStore.get(id);
    if (!found || (found.projectId !== projectId && found.projectId !== "default")) return null;
    return found;
  }

  async createSchedule(projectId: string, input: CreateOnCallScheduleInput): Promise<OnCallSchedule> {
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const schedule: OnCallSchedule = {
      id,
      projectId,
      name: input.name,
      timezone: input.timezone ?? "UTC",
      rotations: input.rotations ?? [
        {
          id: `rot_${Date.now()}`,
          name: "Default Rotation",
          type: "weekly",
          participants: [input.activeOnCallUser ?? "sre-lead@pulseops.dev"],
          activeParticipant: input.activeOnCallUser ?? "sre-lead@pulseops.dev",
          shiftStart: now,
        },
      ],
      activeOnCallUser: input.activeOnCallUser ?? "sre-lead@pulseops.dev",
      createdAt: now,
      updatedAt: now,
    };

    this.schedulesStore.set(id, schedule);
    return schedule;
  }

  async updateSchedule(
    projectId: string,
    id: string,
    input: Partial<CreateOnCallScheduleInput>,
  ): Promise<OnCallSchedule | null> {
    const existing = await this.findScheduleById(projectId, id);
    if (!existing) return null;

    const updated: OnCallSchedule = {
      ...existing,
      name: input.name ?? existing.name,
      timezone: input.timezone ?? existing.timezone,
      rotations: input.rotations ?? existing.rotations,
      activeOnCallUser: input.activeOnCallUser ?? existing.activeOnCallUser,
      updatedAt: new Date().toISOString(),
    };

    this.schedulesStore.set(id, updated);
    return updated;
  }

  async deleteSchedule(projectId: string, id: string): Promise<boolean> {
    const existing = await this.findScheduleById(projectId, id);
    if (!existing) return false;
    return this.schedulesStore.delete(id);
  }

  // Escalation Policies
  async listPolicies(projectId: string): Promise<EscalationPolicy[]> {
    return Array.from(this.policiesStore.values()).filter(
      (p) => p.projectId === projectId || p.projectId === "default",
    );
  }

  async findPolicyById(projectId: string, id: string): Promise<EscalationPolicy | null> {
    const found = this.policiesStore.get(id);
    if (!found || (found.projectId !== projectId && found.projectId !== "default")) return null;
    return found;
  }

  async createPolicy(projectId: string, input: CreateEscalationPolicyInput): Promise<EscalationPolicy> {
    const id = `policy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const policy: EscalationPolicy = {
      id,
      projectId,
      name: input.name,
      steps: input.steps,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.policiesStore.set(id, policy);
    return policy;
  }

  async updatePolicy(
    projectId: string,
    id: string,
    input: Partial<CreateEscalationPolicyInput>,
  ): Promise<EscalationPolicy | null> {
    const existing = await this.findPolicyById(projectId, id);
    if (!existing) return null;

    const updated: EscalationPolicy = {
      ...existing,
      name: input.name ?? existing.name,
      steps: input.steps ?? existing.steps,
      isDefault: input.isDefault ?? existing.isDefault,
      updatedAt: new Date().toISOString(),
    };

    this.policiesStore.set(id, updated);
    return updated;
  }

  async deletePolicy(projectId: string, id: string): Promise<boolean> {
    const existing = await this.findPolicyById(projectId, id);
    if (!existing) return false;
    return this.policiesStore.delete(id);
  }
}
