export type DashboardWidgetType =
  | "timeseries"
  | "toplist"
  | "table"
  | "query_value"
  | "incident_list"
  | "log_stream"
  | "markdown";

export interface DashboardGridPos {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DashboardWidgetConfig {
  readonly metricName?: string | undefined;
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
  readonly queryFilter?: string | undefined;
  readonly timeRange?: string | undefined;
  readonly chartType?: "line" | "area" | "bar" | undefined;
  readonly unit?: string | undefined;
  readonly markdownContent?: string | undefined;
  readonly topLimit?: number | undefined;
  readonly groupBy?: string | undefined;
}

export interface DashboardWidget {
  readonly id: string;
  readonly type: DashboardWidgetType;
  readonly title: string;
  readonly gridPos: DashboardGridPos;
  readonly config: DashboardWidgetConfig;
}

export interface CustomDashboard {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly templateKey?: string | undefined;
  readonly widgets: DashboardWidget[];
  readonly tags: string[];
  readonly refreshIntervalSeconds: number;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QueryExplorerRequest {
  readonly queryType: "logs" | "metrics" | "errors";
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
  readonly severity?: string | undefined;
  readonly searchTerm?: string | undefined;
  readonly timeRangeMinutes?: number | undefined;
  readonly limit?: number | undefined;
}

export interface QueryExplorerTimeseriesPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface QueryExplorerResponse {
  readonly totalCount: number;
  readonly timeseries: QueryExplorerTimeseriesPoint[];
  readonly records: Array<Record<string, unknown>>;
  readonly queriedAt: string;
}
