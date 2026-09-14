import { apiClient } from "@/lib/api-client";

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export type MetricRollupAggregation =
  "count" | "avg" | "sum" | "min" | "max" | "p50" | "p95" | "p99";

export type MetricTimeBucket = "10s" | "1m" | "5m" | "15m" | "1h" | "1d";

export interface MetricDefinition {
  id: string;
  projectId: string;
  name: string;
  type: MetricType;
  unit?: string;
  description?: string;
  tagKeys: string[];
  cardinalityLimit: number;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetricQueryInput {
  metricName: string;
  aggregation: MetricRollupAggregation;
  timeBucket: MetricTimeBucket;
  startTime?: string;
  endTime?: string;
  filters?: Record<string, string>;
  groupBy?: string;
}

export interface MetricTimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeriesResult {
  metricName: string;
  tags: Record<string, string>;
  points: MetricTimeSeriesPoint[];
}

export interface ServiceMetricSummary {
  serviceName: string;
  errorRatePercent: number;
  throughputRps: number;
  p95LatencyMs: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  hostCount: number;
  containerCount: number;
  status: "healthy" | "degraded" | "critical";
}

export interface HighCardinalityViolation {
  metricName: string;
  distinctValues: number;
  threshold: number;
  status: "warning" | "exceeded";
}

export interface CardinalityGuardrailStatus {
  totalMetrics: number;
  activeTagsCount: number;
  highCardinalityViolations: HighCardinalityViolation[];
}

export interface CreateMetricDefinitionInput {
  name: string;
  type: MetricType;
  unit?: string;
  description?: string;
  tagKeys?: string[];
  cardinalityLimit?: number;
  retentionDays?: number;
}

export interface UpdateMetricDefinitionInput {
  name?: string;
  type?: MetricType;
  unit?: string;
  description?: string;
  tagKeys?: string[];
  cardinalityLimit?: number;
  retentionDays?: number;
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function listMetricDefinitions(projectId: string): Promise<MetricDefinition[]> {
  const res = await apiClient.get<ApiResponse<{ metrics: MetricDefinition[] }>>(
    `/metrics/catalog?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.metrics;
}

export async function createMetricDefinition(
  projectId: string,
  input: CreateMetricDefinitionInput,
): Promise<MetricDefinition> {
  const res = await apiClient.post<ApiResponse<{ metric: MetricDefinition }>>(
    `/metrics/catalog?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.metric;
}

export async function updateMetricDefinition(
  projectId: string,
  id: string,
  input: UpdateMetricDefinitionInput,
): Promise<MetricDefinition> {
  const res = await apiClient.patch<ApiResponse<{ metric: MetricDefinition }>>(
    `/metrics/catalog/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.metric;
}

export async function deleteMetricDefinition(projectId: string, id: string): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `/metrics/catalog/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.deleted;
}

export async function queryMetricSeries(
  projectId: string,
  input: MetricQueryInput,
): Promise<MetricTimeSeriesResult[]> {
  const params = new URLSearchParams({
    projectId,
    metricName: input.metricName,
    aggregation: input.aggregation,
    timeBucket: input.timeBucket,
  });
  if (input.startTime) params.set("startTime", input.startTime);
  if (input.endTime) params.set("endTime", input.endTime);
  if (input.groupBy) params.set("groupBy", input.groupBy);

  const res = await apiClient.get<ApiResponse<{ series: MetricTimeSeriesResult[] }>>(
    `/metrics/query?${params.toString()}`,
  );
  return res.data.data.series;
}

export async function getServiceMetricsSummaries(
  projectId: string,
): Promise<ServiceMetricSummary[]> {
  const res = await apiClient.get<ApiResponse<{ summaries: ServiceMetricSummary[] }>>(
    `/metrics/services/summary?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.summaries;
}

export async function getCardinalityGuardrails(
  projectId: string,
): Promise<CardinalityGuardrailStatus> {
  const res = await apiClient.get<ApiResponse<{ guardrails: CardinalityGuardrailStatus }>>(
    `/metrics/cardinality/guardrails?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.guardrails;
}
