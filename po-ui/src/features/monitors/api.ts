import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type MonitorRuleType =
  | "log_match"
  | "metric_threshold"
  | "error_rate"
  | "latency_p95"
  | "queue_backlog"
  | "worker_stale"
  | "vault_anomaly";

export type MonitorState = "ok" | "warning" | "alert" | "no_data";

export type MonitorSeverity = "low" | "medium" | "high" | "critical";

export type MonitorComparator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface MonitorCondition {
  readonly comparator: MonitorComparator;
  readonly threshold: number;
  readonly timeWindowMinutes: number;
  readonly metricName?: string;
  readonly logPattern?: string;
  readonly serviceName?: string;
  readonly environment?: string;
}

export interface MonitorRule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string;
  readonly ruleType: MonitorRuleType;
  readonly severity: MonitorSeverity;
  readonly state: MonitorState;
  readonly enabled: boolean;
  readonly condition: MonitorCondition;
  readonly evaluationIntervalSeconds: number;
  readonly lastEvaluatedAt?: string | null;
  readonly lastStateChangeAt?: string | null;
  readonly lastEvaluatedValue?: number | null;
  readonly lastEvaluationMessage?: string | null;
  readonly tags: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SilenceWindow {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly matchers: {
    readonly serviceName?: string;
    readonly environment?: string;
    readonly ruleType?: MonitorRuleType;
    readonly monitorId?: string;
    readonly severity?: MonitorSeverity;
  };
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
  readonly createdBy?: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MaintenanceWindow {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly services: string[];
  readonly environments: string[];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly suppressIncidents: boolean;
  readonly suppressNotifications: boolean;
  readonly reason: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type NotificationChannelType = "email" | "webhook" | "slack";

export interface NotificationChannelConfig {
  readonly emailRecipients?: string[];
  readonly smtpHost?: string;
  readonly smtpPort?: number;
  readonly webhookUrl?: string;
  readonly webhookSecret?: string;
  readonly slackWebhookUrl?: string;
  readonly channelName?: string;
}

export interface NotificationChannel {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: NotificationChannelType;
  readonly config: NotificationChannelConfig;
  readonly enabled: boolean;
  readonly lastDispatchedAt?: string | null;
  readonly lastDispatchStatus?: "success" | "failed" | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationRoutingRule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly channelIds: string[];
  readonly matchers: {
    readonly service?: string;
    readonly environment?: string;
    readonly severities?: MonitorSeverity[];
    readonly ruleTypes?: MonitorRuleType[];
  };
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export async function listMonitors(
  projectId: string,
  filters: {
    ruleType?: MonitorRuleType;
    state?: MonitorState;
    enabled?: boolean;
  } = {},
): Promise<MonitorRule[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly monitors: MonitorRule[] }>>(
    "/monitors",
    { params: { projectId, ...filters } },
  );
  return response.data.data.monitors;
}

export async function getMonitor(projectId: string, monitorId: string): Promise<MonitorRule> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly monitor: MonitorRule }>>(
    `/monitors/${monitorId}`,
    { params: { projectId } },
  );
  return response.data.data.monitor;
}

export async function createMonitor(
  projectId: string,
  input: {
    name: string;
    description?: string;
    ruleType: MonitorRuleType;
    severity: MonitorSeverity;
    condition: MonitorCondition;
    evaluationIntervalSeconds?: number;
    tags?: string[];
    enabled?: boolean;
  },
): Promise<MonitorRule> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly monitor: MonitorRule }>>(
    "/monitors",
    input,
    { params: { projectId } },
  );
  return response.data.data.monitor;
}

export async function updateMonitor(
  projectId: string,
  monitorId: string,
  input: Partial<{
    name: string;
    description?: string;
    ruleType: MonitorRuleType;
    severity: MonitorSeverity;
    condition: MonitorCondition;
    evaluationIntervalSeconds?: number;
    tags?: string[];
    enabled?: boolean;
  }>,
): Promise<MonitorRule> {
  const response = await apiClient.patch<ApiSuccessResponse<{ readonly monitor: MonitorRule }>>(
    `/monitors/${monitorId}`,
    input,
    { params: { projectId } },
  );
  return response.data.data.monitor;
}

export async function deleteMonitor(projectId: string, monitorId: string): Promise<void> {
  await apiClient.delete(`/monitors/${monitorId}`, { params: { projectId } });
}

export async function evaluateMonitor(
  projectId: string,
  monitorId: string,
): Promise<{
  monitorId: string;
  previousState: MonitorState;
  nextState: MonitorState;
  observedValue: number | null;
  message: string;
  stateChanged: boolean;
}> {
  const response = await apiClient.post<
    ApiSuccessResponse<{
      readonly evaluation: {
        monitorId: string;
        previousState: MonitorState;
        nextState: MonitorState;
        observedValue: number | null;
        message: string;
        stateChanged: boolean;
      };
    }>
  >(`/monitors/${monitorId}/evaluate`, undefined, { params: { projectId } });
  return response.data.data.evaluation;
}

export async function exportMonitors(projectId: string): Promise<Record<string, unknown>> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly bundle: Record<string, unknown> }>
  >("/monitors/export", { params: { projectId } });
  return response.data.data.bundle;
}

export async function importMonitors(
  projectId: string,
  bundle: {
    monitors: Array<Omit<MonitorRule, "id" | "createdAt" | "updatedAt" | "projectId">>;
    channels?: Array<Omit<NotificationChannel, "id" | "createdAt" | "updatedAt" | "projectId">>;
    routingRules?: Array<
      Omit<NotificationRoutingRule, "id" | "createdAt" | "updatedAt" | "projectId">
    >;
  },
): Promise<{ monitors: number; channels: number; routingRules: number }> {
  const response = await apiClient.post<
    ApiSuccessResponse<{
      readonly importedCount: {
        monitors: number;
        channels: number;
        routingRules: number;
      };
    }>
  >("/monitors/import", bundle, { params: { projectId } });
  return response.data.data.importedCount;
}

// Silence & Maintenance Windows
export async function listSilenceWindows(projectId: string): Promise<SilenceWindow[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly windows: SilenceWindow[] }>>(
    "/silence-windows",
    { params: { projectId } },
  );
  return response.data.data.windows;
}

export async function createSilenceWindow(
  projectId: string,
  input: {
    name: string;
    matchers: SilenceWindow["matchers"];
    startsAt: string;
    endsAt: string;
    reason: string;
    enabled?: boolean;
  },
): Promise<SilenceWindow> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly window: SilenceWindow }>>(
    "/silence-windows",
    input,
    { params: { projectId } },
  );
  return response.data.data.window;
}

export async function deleteSilenceWindow(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`/silence-windows/${id}`, { params: { projectId } });
}

export async function listMaintenanceWindows(projectId: string): Promise<MaintenanceWindow[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly windows: MaintenanceWindow[] }>
  >("/maintenance-windows", { params: { projectId } });
  return response.data.data.windows;
}

export async function createMaintenanceWindow(
  projectId: string,
  input: {
    name: string;
    services: string[];
    environments: string[];
    startsAt: string;
    endsAt: string;
    suppressIncidents?: boolean;
    suppressNotifications?: boolean;
    reason: string;
  },
): Promise<MaintenanceWindow> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly window: MaintenanceWindow }>>(
    "/maintenance-windows",
    input,
    { params: { projectId } },
  );
  return response.data.data.window;
}

export async function deleteMaintenanceWindow(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`/maintenance-windows/${id}`, { params: { projectId } });
}

// Channels & Routing
export async function listNotificationChannels(projectId: string): Promise<NotificationChannel[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly channels: NotificationChannel[] }>
  >("/notification-channels", { params: { projectId } });
  return response.data.data.channels;
}

export async function createNotificationChannel(
  projectId: string,
  input: {
    name: string;
    type: NotificationChannelType;
    config: NotificationChannel["config"];
    enabled?: boolean;
  },
): Promise<NotificationChannel> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly channel: NotificationChannel }>
  >("/notification-channels", input, { params: { projectId } });
  return response.data.data.channel;
}

export async function updateNotificationChannel(
  projectId: string,
  id: string,
  input: Partial<{
    name: string;
    type: NotificationChannelType;
    config: NotificationChannel["config"];
    enabled?: boolean;
  }>,
): Promise<NotificationChannel> {
  const response = await apiClient.patch<
    ApiSuccessResponse<{ readonly channel: NotificationChannel }>
  >(`/notification-channels/${id}`, input, { params: { projectId } });
  return response.data.data.channel;
}

export async function deleteNotificationChannel(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`/notification-channels/${id}`, { params: { projectId } });
}

export async function testNotificationChannel(
  projectId: string,
  id: string,
  severity: MonitorSeverity = "high",
): Promise<string> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly message: string }>>(
    `/notification-channels/${id}/test`,
    { severity },
    { params: { projectId } },
  );
  return response.data.data.message;
}

export async function listNotificationRoutingRules(
  projectId: string,
): Promise<NotificationRoutingRule[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly rules: NotificationRoutingRule[] }>
  >("/notification-routing", { params: { projectId } });
  return response.data.data.rules;
}

export async function createNotificationRoutingRule(
  projectId: string,
  input: {
    name: string;
    channelIds: string[];
    matchers?: NotificationRoutingRule["matchers"];
    enabled?: boolean;
  },
): Promise<NotificationRoutingRule> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly rule: NotificationRoutingRule }>
  >("/notification-routing", input, { params: { projectId } });
  return response.data.data.rule;
}

export async function deleteNotificationRoutingRule(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`/notification-routing/${id}`, { params: { projectId } });
}
