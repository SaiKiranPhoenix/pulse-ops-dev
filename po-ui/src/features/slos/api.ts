import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type SliType = "availability" | "latency" | "error_rate" | "custom_metric";

export type SloStatus = "compliant" | "at_risk" | "breached";

export interface SliDefinition {
  readonly type: SliType;
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
  readonly thresholdMs?: number | undefined;
  readonly metricName?: string | undefined;
  readonly goodEventFilter?: string | undefined;
  readonly totalEventFilter?: string | undefined;
}

export interface SloTarget {
  readonly targetPercent: number;
  readonly warningPercent?: number | undefined;
  readonly rollingWindowDays: number;
}

export interface SloCalculation {
  readonly currentSliPercent: number;
  readonly errorBudgetTotalPercent: number;
  readonly errorBudgetRemainingPercent: number;
  readonly errorBudgetConsumedPercent: number;
  readonly burnRate1h: number;
  readonly burnRate6h: number;
  readonly burnRate24h: number;
  readonly estimatedHoursToDepletion: number | null;
  readonly status: SloStatus;
  readonly totalEventsCount: number;
  readonly goodEventsCount: number;
  readonly badEventsCount: number;
  readonly evaluatedAt: string;
}

export interface SloHistoryPoint {
  readonly timestamp: string;
  readonly sliPercent: number;
  readonly remainingBudgetPercent: number;
  readonly burnRate1h: number;
  readonly status: SloStatus;
}

export interface SloDocumentData {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly sli: SliDefinition;
  readonly target: SloTarget;
  readonly tags: string[];
  readonly enabled: boolean;
  readonly calculation?: SloCalculation | null | undefined;
  readonly history?: SloHistoryPoint[] | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReliabilityReport {
  readonly projectId: string;
  readonly overallReliabilityScore: number;
  readonly totalSlos: number;
  readonly compliantCount: number;
  readonly atRiskCount: number;
  readonly breachedCount: number;
  readonly averageRemainingBudgetPercent: number;
  readonly generatedAt: string;
}

export async function listSlos(
  projectId: string,
  filters: {
    serviceName?: string;
    environment?: string;
    status?: SloStatus;
    enabled?: boolean;
  } = {},
): Promise<SloDocumentData[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly slos: SloDocumentData[] }>>(
    "/slos",
    { params: { projectId, ...filters } },
  );
  return response.data.data.slos;
}

export async function getSlo(projectId: string, sloId: string): Promise<SloDocumentData> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly slo: SloDocumentData }>>(
    `/slos/${sloId}`,
    { params: { projectId } },
  );
  return response.data.data.slo;
}

export async function createSlo(
  projectId: string,
  input: {
    name: string;
    description?: string;
    sli: SliDefinition;
    target: SloTarget;
    tags?: string[];
    enabled?: boolean;
  },
): Promise<SloDocumentData> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly slo: SloDocumentData }>>(
    "/slos",
    input,
    { params: { projectId } },
  );
  return response.data.data.slo;
}

export async function updateSlo(
  projectId: string,
  sloId: string,
  input: Partial<{
    name: string;
    description?: string;
    sli: SliDefinition;
    target: SloTarget;
    tags?: string[];
    enabled?: boolean;
  }>,
): Promise<SloDocumentData> {
  const response = await apiClient.patch<ApiSuccessResponse<{ readonly slo: SloDocumentData }>>(
    `/slos/${sloId}`,
    input,
    { params: { projectId } },
  );
  return response.data.data.slo;
}

export async function deleteSlo(projectId: string, sloId: string): Promise<void> {
  await apiClient.delete(`/slos/${sloId}`, { params: { projectId } });
}

export async function evaluateSlo(
  projectId: string,
  sloId: string,
): Promise<{
  slo: SloDocumentData;
  calculation: SloCalculation;
  incidentTriggered: boolean;
}> {
  const response = await apiClient.post<
    ApiSuccessResponse<{
      readonly slo: SloDocumentData;
      readonly calculation: SloCalculation;
      readonly incidentTriggered: boolean;
    }>
  >(`/slos/${sloId}/evaluate`, undefined, { params: { projectId } });
  return response.data.data;
}

export async function getReliabilityReport(projectId: string): Promise<ReliabilityReport> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly report: ReliabilityReport }>
  >("/slos/report", { params: { projectId } });
  return response.data.data.report;
}

export async function seedDemoSlos(
  projectId: string,
): Promise<{ seededCount: number; slos: SloDocumentData[] }> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly seededCount: number; readonly slos: SloDocumentData[] }>
  >("/slos/seed-demo", undefined, { params: { projectId } });
  return response.data.data;
}
