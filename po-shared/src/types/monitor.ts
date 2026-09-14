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
  readonly metricName?: string | undefined;
  readonly logPattern?: string | undefined;
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
}

export interface MonitorRule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly ruleType: MonitorRuleType;
  readonly severity: MonitorSeverity;
  readonly state: MonitorState;
  readonly enabled: boolean;
  readonly condition: MonitorCondition;
  readonly evaluationIntervalSeconds: number;
  readonly lastEvaluatedAt?: string | null | undefined;
  readonly lastStateChangeAt?: string | null | undefined;
  readonly lastEvaluatedValue?: number | null | undefined;
  readonly lastEvaluationMessage?: string | null | undefined;
  readonly tags: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SilenceWindow {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly matchers: {
    readonly serviceName?: string | undefined;
    readonly environment?: string | undefined;
    readonly ruleType?: MonitorRuleType | undefined;
    readonly monitorId?: string | undefined;
    readonly severity?: MonitorSeverity | undefined;
  };
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
  readonly createdBy?: string | undefined;
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
  readonly emailRecipients?: string[] | undefined;
  readonly smtpHost?: string | undefined;
  readonly smtpPort?: number | undefined;
  readonly webhookUrl?: string | undefined;
  readonly webhookSecret?: string | undefined;
  readonly slackWebhookUrl?: string | undefined;
  readonly channelName?: string | undefined;
}

export interface NotificationChannel {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly type: NotificationChannelType;
  readonly config: NotificationChannelConfig;
  readonly enabled: boolean;
  readonly lastDispatchedAt?: string | null | undefined;
  readonly lastDispatchStatus?: "success" | "failed" | null | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationRoutingRule {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly channelIds: string[];
  readonly matchers: {
    readonly service?: string | undefined;
    readonly environment?: string | undefined;
    readonly severities?: MonitorSeverity[] | undefined;
    readonly ruleTypes?: MonitorRuleType[] | undefined;
  };
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AlertNotificationPayload {
  readonly monitorId: string;
  readonly monitorName: string;
  readonly projectId: string;
  readonly state: MonitorState;
  readonly severity: MonitorSeverity;
  readonly ruleType: MonitorRuleType;
  readonly value?: number | null | undefined;
  readonly threshold: number;
  readonly message: string;
  readonly timestamp: string;
  readonly serviceName?: string | undefined;
  readonly environment?: string | undefined;
}
