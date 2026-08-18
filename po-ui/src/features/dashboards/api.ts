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
  readonly observedAt: string;
  readonly receivedAt: string;
};

export type DashboardIncident = {
  readonly id: string;
  readonly title: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "resolved";
  readonly eventCount: number;
  readonly lastSeenAt: string;
};

export type WorkerStatusResponse = {
  readonly workers: unknown[];
  readonly status: "not_configured";
};

export type QueueStatusResponse = {
  readonly queues: unknown[];
  readonly status: "not_configured";
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
