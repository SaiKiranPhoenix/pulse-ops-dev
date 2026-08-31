import { apiClient } from "@/lib/api-client";

export type LogProcessorType =
  | "parse_json"
  | "remap_fields"
  | "redact_regex"
  | "drop_filter"
  | "sample_rate"
  | "add_tags";

export interface LogProcessorConfig {
  sourceField?: string;
  targetField?: string;
  fieldMappings?: Record<string, string>;
  redactionPatterns?: string[];
  redactionReplacement?: string;
  dropFilter?: string;
  sampleRatePercent?: number;
  tags?: Record<string, string>;
}

export interface LogPipelineProcessor {
  id: string;
  type: LogProcessorType;
  name: string;
  enabled: boolean;
  config: LogProcessorConfig;
}

export interface LogPipelineRule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  order: number;
  enabled: boolean;
  processors: LogPipelineProcessor[];
  createdAt: string;
  updatedAt: string;
}

export interface LogRetentionSettings {
  projectId: string;
  retentionDays: number;
  coldArchiveEnabled: boolean;
  coldArchiveBucket?: string;
  updatedAt: string;
}

export interface SavedLogSearch {
  id: string;
  projectId: string;
  name: string;
  query: string;
  serviceFilter?: string;
  levelFilter?: string;
  environment?: string;
  timeframe: string;
  createdAt: string;
}

export interface LogContextResponse {
  targetEventId: string;
  before: Array<Record<string, unknown>>;
  target: Record<string, unknown> | null;
  after: Array<Record<string, unknown>>;
}

export interface LogVolumeAnalytics {
  projectId: string;
  totalEventsPerSec: number;
  totalBytesPerSec: number;
  byService: Record<string, number>;
  byLevel: Record<string, number>;
  sampledPercentage: number;
  redactedCount: number;
  timestamp: string;
}

export interface CreateLogPipelineRuleInput {
  name: string;
  description?: string;
  order?: number;
  enabled?: boolean;
  processors?: LogPipelineProcessor[];
}

export interface UpdateLogPipelineRuleInput {
  name?: string;
  description?: string;
  order?: number;
  enabled?: boolean;
  processors?: LogPipelineProcessor[];
}

export interface UpdateLogRetentionSettingsInput {
  retentionDays: number;
  coldArchiveEnabled?: boolean;
  coldArchiveBucket?: string;
}

export interface CreateSavedLogSearchInput {
  name: string;
  query: string;
  serviceFilter?: string;
  levelFilter?: string;
  environment?: string;
  timeframe?: string;
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function listLogPipelineRules(projectId: string): Promise<LogPipelineRule[]> {
  const res = await apiClient.get<ApiResponse<{ rules: LogPipelineRule[] }>>(
    `/log-pipelines?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.rules;
}

export async function createLogPipelineRule(
  projectId: string,
  input: CreateLogPipelineRuleInput,
): Promise<LogPipelineRule> {
  const res = await apiClient.post<ApiResponse<{ rule: LogPipelineRule }>>(
    `/log-pipelines?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.rule;
}

export async function updateLogPipelineRule(
  projectId: string,
  ruleId: string,
  input: UpdateLogPipelineRuleInput,
): Promise<LogPipelineRule> {
  const res = await apiClient.patch<ApiResponse<{ rule: LogPipelineRule }>>(
    `/log-pipelines/${encodeURIComponent(ruleId)}?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.rule;
}

export async function deleteLogPipelineRule(
  projectId: string,
  ruleId: string,
): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `/log-pipelines/${encodeURIComponent(ruleId)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.deleted;
}

export async function getLogRetention(projectId: string): Promise<LogRetentionSettings> {
  const res = await apiClient.get<ApiResponse<{ retention: LogRetentionSettings }>>(
    `/logs/retention?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.retention;
}

export async function updateLogRetention(
  projectId: string,
  input: UpdateLogRetentionSettingsInput,
): Promise<LogRetentionSettings> {
  const res = await apiClient.put<ApiResponse<{ retention: LogRetentionSettings }>>(
    `/logs/retention?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.retention;
}

export async function listSavedLogSearches(projectId: string): Promise<SavedLogSearch[]> {
  const res = await apiClient.get<ApiResponse<{ savedSearches: SavedLogSearch[] }>>(
    `/logs/saved-searches?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.savedSearches;
}

export async function createSavedLogSearch(
  projectId: string,
  input: CreateSavedLogSearchInput,
): Promise<SavedLogSearch> {
  const res = await apiClient.post<ApiResponse<{ savedSearch: SavedLogSearch }>>(
    `/logs/saved-searches?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.savedSearch;
}

export async function deleteSavedLogSearch(
  projectId: string,
  searchId: string,
): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `/logs/saved-searches/${encodeURIComponent(searchId)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.deleted;
}

export async function getLogContext(
  projectId: string,
  eventId: string,
): Promise<LogContextResponse> {
  const res = await apiClient.get<ApiResponse<LogContextResponse>>(
    `/logs/${encodeURIComponent(eventId)}/context?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data;
}

export async function getLogVolumeAnalytics(projectId: string): Promise<LogVolumeAnalytics> {
  const res = await apiClient.get<ApiResponse<{ analytics: LogVolumeAnalytics }>>(
    `/logs/analytics/volume?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.analytics;
}
