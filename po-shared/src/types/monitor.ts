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

export interface AlertNotificationPayload {
  readonly monitorId: string;
  readonly monitorName: string;
  readonly projectId: string;
  readonly state: MonitorState;
  readonly severity: MonitorSeverity;
  readonly ruleType: MonitorRuleType;
  readonly value?: number | null;
  readonly threshold: number;
  readonly message: string;
  readonly timestamp: string;
  readonly environment?: string;
  readonly serviceName?: string;
}
