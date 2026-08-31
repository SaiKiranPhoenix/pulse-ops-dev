export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export type MetricRollupAggregation =
  | "count"
  | "avg"
  | "sum"
  | "min"
  | "max"
  | "p50"
  | "p95"
  | "p99";

export type MetricTimeBucket = "10s" | "1m" | "5m" | "15m" | "1h" | "1d";

export interface MetricDefinition {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: MetricType;
  readonly unit?: string | undefined;
  readonly description?: string | undefined;
  readonly tagKeys: string[];
  readonly cardinalityLimit: number;
  readonly retentionDays: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MetricQueryInput {
  readonly metricName: string;
  readonly aggregation: MetricRollupAggregation;
  readonly timeBucket: MetricTimeBucket;
  readonly startTime?: string | undefined;
  readonly endTime?: string | undefined;
  readonly filters?: Record<string, string> | undefined;
  readonly groupBy?: string | undefined;
}

export interface MetricTimeSeriesPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface MetricTimeSeriesResult {
  readonly metricName: string;
  readonly tags: Record<string, string>;
  readonly points: MetricTimeSeriesPoint[];
}

export interface ServiceMetricSummary {
  readonly serviceName: string;
  readonly errorRatePercent: number;
  readonly throughputRps: number;
  readonly p95LatencyMs: number;
  readonly cpuUsagePercent: number;
  readonly memoryUsageMb: number;
  readonly hostCount: number;
  readonly containerCount: number;
  readonly status: "healthy" | "degraded" | "critical";
}

export interface HighCardinalityViolation {
  readonly metricName: string;
  readonly distinctValues: number;
  readonly threshold: number;
  readonly status: "warning" | "exceeded";
}

export interface CardinalityGuardrailStatus {
  readonly totalMetrics: number;
  readonly activeTagsCount: number;
  readonly highCardinalityViolations: HighCardinalityViolation[];
}

export interface CreateMetricDefinitionInput {
  readonly name: string;
  readonly type: MetricType;
  readonly unit?: string | undefined;
  readonly description?: string | undefined;
  readonly tagKeys?: string[] | undefined;
  readonly cardinalityLimit?: number | undefined;
  readonly retentionDays?: number | undefined;
}

export interface UpdateMetricDefinitionInput {
  readonly name?: string | undefined;
  readonly type?: MetricType | undefined;
  readonly unit?: string | undefined;
  readonly description?: string | undefined;
  readonly tagKeys?: string[] | undefined;
  readonly cardinalityLimit?: number | undefined;
  readonly retentionDays?: number | undefined;
}
