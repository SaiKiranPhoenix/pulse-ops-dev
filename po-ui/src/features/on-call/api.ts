import { apiClient } from "@/lib/api-client";

export interface OnCallRotation {
  id: string;
  name: string;
  type: "daily" | "weekly" | "custom";
  participants: string[];
  activeParticipant: string;
  shiftStart: string;
}

export interface OnCallSchedule {
  id: string;
  projectId: string;
  name: string;
  timezone: string;
  rotations: OnCallRotation[];
  activeOnCallUser: string;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationStep {
  stepNumber: number;
  delayMinutes: number;
  targetType: "user" | "schedule" | "channel";
  targetId: string;
}

export interface EscalationPolicy {
  id: string;
  projectId: string;
  name: string;
  steps: EscalationStep[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostmortemReport {
  incidentId: string;
  summary: string;
  rootCause: string;
  trigger: string;
  impactDurationMinutes: number;
  detectionTimeMinutes: number;
  resolutionTimeMinutes: number;
  actionItems: Array<{ id: string; description: string; assignee?: string; completed: boolean }>;
  status: "draft" | "published";
  updatedAt: string;
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function listOnCallSchedules(projectId: string): Promise<OnCallSchedule[]> {
  const res = await apiClient.get<ApiResponse<{ schedules: OnCallSchedule[] }>>(
    `/on-call/schedules?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.schedules;
}

export async function createOnCallSchedule(
  projectId: string,
  input: { name: string; timezone?: string; activeOnCallUser?: string },
): Promise<OnCallSchedule> {
  const res = await apiClient.post<ApiResponse<{ schedule: OnCallSchedule }>>(
    `/on-call/schedules?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.schedule;
}

export async function listEscalationPolicies(projectId: string): Promise<EscalationPolicy[]> {
  const res = await apiClient.get<ApiResponse<{ policies: EscalationPolicy[] }>>(
    `/on-call/escalation-policies?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.policies;
}

export async function createEscalationPolicy(
  projectId: string,
  input: { name: string; steps: EscalationStep[]; isDefault?: boolean },
): Promise<EscalationPolicy> {
  const res = await apiClient.post<ApiResponse<{ policy: EscalationPolicy }>>(
    `/on-call/escalation-policies?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.policy;
}

export async function triageIncident(
  projectId: string,
  incidentId: string,
  input: { severity?: "critical" | "high" | "medium" | "low"; assignee?: string; runbookUrl?: string },
): Promise<unknown> {
  const res = await apiClient.patch<ApiResponse<{ incident: unknown }>>(
    `/incidents/${encodeURIComponent(incidentId)}/triage?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.incident;
}

export async function addIncidentComment(
  projectId: string,
  incidentId: string,
  input: { message: string; userName?: string },
): Promise<unknown> {
  const res = await apiClient.post<ApiResponse<{ incident: unknown }>>(
    `/incidents/${encodeURIComponent(incidentId)}/comments?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.incident;
}

export async function savePostmortem(
  projectId: string,
  incidentId: string,
  input: PostmortemReport,
): Promise<unknown> {
  const res = await apiClient.put<ApiResponse<{ incident: unknown }>>(
    `/incidents/${encodeURIComponent(incidentId)}/postmortem?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.incident;
}

export async function exportIncidentSummary(
  projectId: string,
  incidentId: string,
): Promise<{ markdown: string }> {
  const res = await apiClient.get<ApiResponse<{ markdown: string }>>(
    `/incidents/${encodeURIComponent(incidentId)}/export?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data;
}
