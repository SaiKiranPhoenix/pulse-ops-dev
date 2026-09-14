export type IncidentTimelineType =
  | "created"
  | "acknowledged"
  | "resolved"
  | "reopened"
  | "severity_changed"
  | "assigned"
  | "comment_added"
  | "escalated";

export interface IncidentTimelineEntry {
  readonly id: string;
  readonly incidentId: string;
  readonly timestamp: string;
  readonly type: IncidentTimelineType;
  readonly actor: string;
  readonly description: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IncidentComment {
  readonly id: string;
  readonly incidentId: string;
  readonly userId: string;
  readonly userName: string;
  readonly message: string;
  readonly createdAt: string;
}

export type RelatedResourceType = "log" | "trace" | "metric" | "service" | "monitor" | "runbook";

export interface IncidentRelatedResource {
  readonly id: string;
  readonly type: RelatedResourceType;
  readonly title: string;
  readonly url: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ActionItem {
  readonly id: string;
  readonly description: string;
  readonly assignee?: string | undefined;
  readonly completed: boolean;
}

export interface PostmortemReport {
  readonly incidentId: string;
  readonly summary: string;
  readonly rootCause: string;
  readonly trigger: string;
  readonly impactDurationMinutes: number;
  readonly detectionTimeMinutes: number;
  readonly resolutionTimeMinutes: number;
  readonly actionItems: ActionItem[];
  readonly status: "draft" | "published";
  readonly updatedAt: string;
}

export interface OnCallRotation {
  readonly id: string;
  readonly name: string;
  readonly type: "daily" | "weekly" | "custom";
  readonly participants: string[];
  readonly activeParticipant: string;
  readonly shiftStart: string;
}

export interface OnCallSchedule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly timezone: string;
  readonly rotations: OnCallRotation[];
  readonly activeOnCallUser: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EscalationStep {
  readonly stepNumber: number;
  readonly delayMinutes: number;
  readonly targetType: "user" | "schedule" | "channel";
  readonly targetId: string;
}

export interface EscalationPolicy {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly steps: EscalationStep[];
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TriageIncidentInput {
  readonly severity?: "critical" | "high" | "medium" | "low" | undefined;
  readonly assignee?: string | undefined;
  readonly runbookUrl?: string | undefined;
}

export interface AddIncidentCommentInput {
  readonly message: string;
  readonly userId?: string | undefined;
  readonly userName?: string | undefined;
}

export interface CreateOnCallScheduleInput {
  readonly name: string;
  readonly timezone?: string | undefined;
  readonly rotations?: OnCallRotation[] | undefined;
  readonly activeOnCallUser?: string | undefined;
}

export interface CreateEscalationPolicyInput {
  readonly name: string;
  readonly steps: EscalationStep[];
  readonly isDefault?: boolean | undefined;
}
