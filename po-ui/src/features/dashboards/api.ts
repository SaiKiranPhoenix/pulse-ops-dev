import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type DashboardSummary = {
  readonly projectId: string;
  readonly totalEvents: number;
  readonly openIncidents: number;
};

export type DashboardEvent = {
  readonly id: string;
  readonly type: "log" | "error" | "metric";
  readonly source: string;
  readonly level: string | null;
  readonly message: string | null;
  readonly name: string | null;
  readonly value: number | null;
  readonly fingerprint: string;
  readonly attributes: Record<string, unknown>;
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type DashboardIncident = {
  readonly id: string;
  readonly projectId?: string;
  readonly fingerprint?: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "resolved";
  readonly eventCount: number;
  readonly firstSeenAt?: string;
  readonly lastSeenAt: string;
  readonly resolvedAt?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type WorkerHealth = {
  readonly workerId: string;
  readonly service: string;
  readonly status: "running";
  readonly queues: string[];
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly ageSeconds: number;
};

export type WorkerStatusResponse = {
  readonly workers: WorkerHealth[];
};

export type QueueStatus = {
  readonly name: string;
  readonly status: "available" | "missing";
  readonly messageCount: number | null;
  readonly consumerCount: number | null;
};

export type QueueStatusResponse = {
  readonly queues: QueueStatus[];
};

export type RealtimeIncidentUpdate = {
  readonly messageId: string;
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly action: "opened" | "updated" | "resolved" | "reopened";
  readonly incident: DashboardIncident;
  readonly occurredAt: string;
};

export async function getDashboardSummary(projectId: string): Promise<DashboardSummary> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly summary: DashboardSummary }>>(
    "/dashboard/summary",
    { params: { projectId } },
  );
  return response.data.data.summary;
}

export async function listDashboardEvents(projectId: string): Promise<DashboardEvent[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly events: DashboardEvent[] }>>(
    "/dashboard/events",
    { params: { projectId } },
  );
  return response.data.data.events;
}

export async function listDashboardIncidents(projectId: string): Promise<DashboardIncident[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly incidents: DashboardIncident[] }>
  >("/dashboard/incidents", { params: { projectId } });
  return response.data.data.incidents;
}

export async function getWorkerStatus(): Promise<WorkerStatusResponse> {
  const response =
    await apiClient.get<ApiSuccessResponse<WorkerStatusResponse>>("/dashboard/workers");
  return response.data.data;
}

export async function getQueueStatus(): Promise<QueueStatusResponse> {
  const response =
    await apiClient.get<ApiSuccessResponse<QueueStatusResponse>>("/dashboard/queues");
  return response.data.data;
}
