import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type Incident = {
  readonly id: string;
  readonly projectId: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly summary: string | null;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "resolved";
  readonly eventCount: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function listIncidents(
  projectId: string,
  status?: Incident["status"],
): Promise<Incident[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly incidents: Incident[] }>>(
    "/incidents",
    { params: { projectId, status } },
  );
  return response.data.data.incidents;
}

export async function getIncident(projectId: string, incidentId: string): Promise<Incident> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly incident: Incident }>>(
    `/incidents/${incidentId}`,
    { params: { projectId } },
  );
  return response.data.data.incident;
}

export async function resolveIncident(projectId: string, incidentId: string): Promise<Incident> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly incident: Incident }>>(
    `/incidents/${incidentId}/resolve`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.incident;
}

export async function reopenIncident(projectId: string, incidentId: string): Promise<Incident> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly incident: Incident }>>(
    `/incidents/${incidentId}/reopen`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.incident;
}
