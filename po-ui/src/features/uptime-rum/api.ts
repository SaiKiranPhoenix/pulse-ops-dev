import { apiClient } from "@/lib/api-client";

export type UptimeCheckStatus = "up" | "down" | "degraded" | "paused";
export type HttpMethod = "GET" | "POST" | "HEAD" | "PUT" | "PATCH" | "DELETE";

export type AssertionType = "status_code" | "response_time" | "body_contains" | "header_matches";
export type AssertionOperator = "equals" | "less_than" | "greater_than" | "contains" | "regex";

export interface SyntheticAssertion {
  type: AssertionType;
  target: string;
  operator: AssertionOperator;
  expectedValue: string | number;
}

export interface UptimeCheck {
  id: string;
  projectId: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusCode: number;
  syntheticAssertions?: SyntheticAssertion[];
  status: UptimeCheckStatus;
  uptimePercent24h: number;
  avgResponseTimeMs: number;
  lastCheckedAt?: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssertionEvaluationResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface UptimeCheckResult {
  id: string;
  checkId: string;
  timestamp: string;
  status: "up" | "down" | "degraded";
  statusCode?: number;
  responseTimeMs: number;
  assertionResults: AssertionEvaluationResult[];
  error?: string;
}

export type WebVitalGrade = "good" | "needs_improvement" | "poor";

export interface RumOverview {
  totalPageViews: number;
  avgLcpMs: number;
  avgFidMs: number;
  avgCls: number;
  avgTtfbMs: number;
  lcpGrade: WebVitalGrade;
  fidGrade: WebVitalGrade;
  clsGrade: WebVitalGrade;
  browserBreakdown: Array<{ browser: string; count: number; percentage: number }>;
  deviceBreakdown: Array<{ device: string; count: number; percentage: number }>;
}

export interface CreateUptimeCheckInput {
  name: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  expectedStatusCode?: number;
  syntheticAssertions?: SyntheticAssertion[];
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function listUptimeChecks(projectId: string): Promise<UptimeCheck[]> {
  const res = await apiClient.get<ApiResponse<{ checks: UptimeCheck[] }>>(
    `/uptime/checks?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.checks;
}

export async function createUptimeCheck(
  projectId: string,
  input: CreateUptimeCheckInput,
): Promise<UptimeCheck> {
  const res = await apiClient.post<ApiResponse<{ check: UptimeCheck }>>(
    `/uptime/checks?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.check;
}

export async function testUptimeCheck(
  projectId: string,
  id: string,
): Promise<UptimeCheckResult> {
  const res = await apiClient.post<ApiResponse<{ result: UptimeCheckResult }>>(
    `/uptime/checks/${encodeURIComponent(id)}/test?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.result;
}

export async function deleteUptimeCheck(
  projectId: string,
  id: string,
): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `/uptime/checks/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.deleted;
}

export async function getUptimeCheckHistory(
  projectId: string,
  id: string,
): Promise<UptimeCheckResult[]> {
  const res = await apiClient.get<ApiResponse<{ history: UptimeCheckResult[] }>>(
    `/uptime/checks/${encodeURIComponent(id)}/history?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.history;
}

export async function getRumOverview(projectId: string): Promise<RumOverview> {
  const res = await apiClient.get<ApiResponse<{ overview: RumOverview }>>(
    `/rum/overview?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.overview;
}
