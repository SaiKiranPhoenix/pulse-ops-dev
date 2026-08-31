import { apiClient } from "@/lib/api-client";

export type DashboardWidgetType =
  "timeseries" | "toplist" | "table" | "query_value" | "incident_list" | "log_stream" | "markdown";

export interface DashboardGridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidgetConfig {
  metricName?: string;
  serviceName?: string;
  environment?: string;
  queryFilter?: string;
  timeRange?: string;
  chartType?: "line" | "area" | "bar";
  unit?: string;
  markdownContent?: string;
  topLimit?: number;
  groupBy?: string;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  gridPos: DashboardGridPos;
  config: DashboardWidgetConfig;
}

export interface CustomDashboard {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  templateKey?: string;
  widgets: DashboardWidget[];
  tags: string[];
  refreshIntervalSeconds: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QueryExplorerRequest {
  queryType: "logs" | "metrics" | "errors";
  serviceName?: string;
  environment?: string;
  severity?: string;
  searchTerm?: string;
  timeRangeMinutes?: number;
  limit?: number;
}

export interface QueryExplorerTimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface QueryExplorerResponse {
  totalCount: number;
  timeseries: QueryExplorerTimeseriesPoint[];
  records: Array<Record<string, unknown>>;
  queriedAt: string;
}

export async function listCustomDashboards(projectId: string): Promise<CustomDashboard[]> {
  const response = await apiClient.get<{ dashboards: CustomDashboard[] }>("/custom-dashboards", {
    headers: { "x-project-id": projectId },
    params: { projectId },
  });
  return response.data.dashboards;
}

export async function getCustomDashboard(
  projectId: string,
  dashboardId: string,
): Promise<CustomDashboard> {
  const response = await apiClient.get<{ dashboard: CustomDashboard }>(
    `/custom-dashboards/${dashboardId}`,
    {
      headers: { "x-project-id": projectId },
      params: { projectId },
    },
  );
  return response.data.dashboard;
}

export async function createCustomDashboard(
  projectId: string,
  data: {
    name: string;
    description?: string;
    templateKey?: string;
    widgets?: DashboardWidget[];
    tags?: string[];
    refreshIntervalSeconds?: number;
    isDefault?: boolean;
  },
): Promise<CustomDashboard> {
  const response = await apiClient.post<{ dashboard: CustomDashboard }>(
    "/custom-dashboards",
    data,
    {
      headers: { "x-project-id": projectId },
      params: { projectId },
    },
  );
  return response.data.dashboard;
}

export async function updateCustomDashboard(
  projectId: string,
  dashboardId: string,
  data: Partial<CustomDashboard>,
): Promise<CustomDashboard> {
  const response = await apiClient.patch<{ dashboard: CustomDashboard }>(
    `/custom-dashboards/${dashboardId}`,
    data,
    {
      headers: { "x-project-id": projectId },
      params: { projectId },
    },
  );
  return response.data.dashboard;
}

export async function deleteCustomDashboard(projectId: string, dashboardId: string): Promise<void> {
  await apiClient.delete(`/custom-dashboards/${dashboardId}`, {
    headers: { "x-project-id": projectId },
    params: { projectId },
  });
}

export async function cloneCustomDashboard(
  projectId: string,
  dashboardId: string,
  name?: string,
): Promise<CustomDashboard> {
  const response = await apiClient.post<{ dashboard: CustomDashboard }>(
    `/custom-dashboards/${dashboardId}/clone`,
    { name },
    {
      headers: { "x-project-id": projectId },
      params: { projectId },
    },
  );
  return response.data.dashboard;
}

export async function seedCustomDashboardTemplates(
  projectId: string,
): Promise<{ seededCount: number; dashboards: CustomDashboard[] }> {
  const response = await apiClient.post<{ seededCount: number; dashboards: CustomDashboard[] }>(
    "/custom-dashboards/seed-templates",
    {},
    {
      headers: { "x-project-id": projectId },
      params: { projectId },
    },
  );
  return response.data;
}

export async function executeQueryExplorer(
  projectId: string,
  query: QueryExplorerRequest,
): Promise<QueryExplorerResponse> {
  const response = await apiClient.post<QueryExplorerResponse>("/explorer/query", query, {
    headers: { "x-project-id": projectId },
    params: { projectId },
  });
  return response.data;
}
