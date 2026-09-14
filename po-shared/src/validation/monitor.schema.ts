import { z } from "zod";

export const monitorRuleTypeSchema = z.enum([
  "log_match",
  "metric_threshold",
  "error_rate",
  "latency_p95",
  "queue_backlog",
  "worker_stale",
  "vault_anomaly",
]);

export const monitorStateSchema = z.enum(["ok", "warning", "alert", "no_data"]);

export const monitorSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const monitorComparatorSchema = z.enum([">", ">=", "<", "<=", "==", "!="]);

export const monitorConditionSchema = z.object({
  comparator: monitorComparatorSchema,
  threshold: z.number(),
  timeWindowMinutes: z.number().int().min(1).max(1440).default(5),
  metricName: z.string().trim().optional(),
  logPattern: z.string().trim().optional(),
  serviceName: z.string().trim().optional(),
  environment: z.string().trim().optional(),
});

export const createMonitorSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  ruleType: monitorRuleTypeSchema,
  severity: monitorSeveritySchema.default("high"),
  condition: monitorConditionSchema,
  evaluationIntervalSeconds: z.number().int().min(10).max(3600).default(60),
  tags: z.array(z.string().trim()).default([]),
  enabled: z.boolean().default(true),
});

export const updateMonitorSchema = createMonitorSchema.partial().omit({ projectId: true });

export const createSilenceWindowSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  matchers: z
    .object({
      serviceName: z.string().trim().optional(),
      environment: z.string().trim().optional(),
      ruleType: monitorRuleTypeSchema.optional(),
      monitorId: z.string().trim().optional(),
      severity: monitorSeveritySchema.optional(),
    })
    .default({}),
  startsAt: z.string().datetime().or(z.string().min(1)),
  endsAt: z.string().datetime().or(z.string().min(1)),
  reason: z.string().trim().min(2).max(500),
  createdBy: z.string().trim().optional(),
  enabled: z.boolean().default(true),
});

export const createMaintenanceWindowSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  services: z.array(z.string().trim()).default([]),
  environments: z.array(z.string().trim()).default([]),
  startsAt: z.string().datetime().or(z.string().min(1)),
  endsAt: z.string().datetime().or(z.string().min(1)),
  suppressIncidents: z.boolean().default(true),
  suppressNotifications: z.boolean().default(true),
  reason: z.string().trim().min(2).max(500),
});

export const notificationChannelTypeSchema = z.enum(["email", "webhook", "slack"]);

export const notificationChannelConfigSchema = z.object({
  emailRecipients: z.array(z.string().email()).optional(),
  smtpHost: z.string().trim().optional(),
  smtpPort: z.number().int().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().trim().optional(),
  slackWebhookUrl: z.string().url().optional(),
  channelName: z.string().trim().optional(),
});

export const createNotificationChannelSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  type: notificationChannelTypeSchema,
  config: notificationChannelConfigSchema,
  enabled: z.boolean().default(true),
});

export const updateNotificationChannelSchema = createNotificationChannelSchema
  .partial()
  .omit({ projectId: true });

export const createNotificationRoutingRuleSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  channelIds: z.array(z.string().min(1)).min(1),
  matchers: z
    .object({
      service: z.string().trim().optional(),
      environment: z.string().trim().optional(),
      severities: z.array(monitorSeveritySchema).optional(),
      ruleTypes: z.array(monitorRuleTypeSchema).optional(),
    })
    .default({}),
  enabled: z.boolean().default(true),
});

export const monitorImportBundleSchema = z.object({
  version: z.literal("1.0"),
  monitors: z.array(createMonitorSchema.omit({ projectId: true })),
  channels: z.array(createNotificationChannelSchema.omit({ projectId: true })).optional(),
  routingRules: z.array(createNotificationRoutingRuleSchema.omit({ projectId: true })).optional(),
});
