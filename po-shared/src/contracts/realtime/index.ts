import { z } from "zod";

export const REALTIME_SOCKET_EVENTS = {
  eventCreated: "event.created",
  incidentUpdated: "incident.updated",
  queueStatus: "queue.status",
  vaultAuditCreated: "vault.audit.created",
  workerHeartbeat: "worker.heartbeat",
} as const;

export const PROJECT_ROOM_PREFIX = "project";
export const OPS_ROOM = "ops";

export function toProjectRoom(projectId: string): string {
  return `${PROJECT_ROOM_PREFIX}:${projectId}`;
}

export function toProjectEnvironmentRoom(projectId: string, environment: string): string {
  return `${toProjectRoom(projectId)}:env:${environment}`;
}

export const realtimeIncidentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fingerprint: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "acknowledged", "resolved"]),
  eventCount: z.number().int().min(1),
  creationReason: z.string().min(1),
  acknowledgedAt: z.string().datetime().nullable(),
  resolutionNote: z.string().nullable(),
  samples: z.array(
    z.object({
      eventId: z.string().min(1),
      telemetryMessageId: z.string().min(1),
      source: z.string().min(1),
      level: z.string().min(1).nullable(),
      message: z.string().min(1).nullable(),
      observedAt: z.string().datetime(),
      receivedAt: z.string().datetime(),
    }),
  ),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RealtimeIncident = z.infer<typeof realtimeIncidentSchema>;

export const realtimeIncidentUpdateActionSchema = z.enum([
  "opened",
  "updated",
  "acknowledged",
  "resolved",
  "reopened",
]);
export type RealtimeIncidentUpdateAction = z.infer<typeof realtimeIncidentUpdateActionSchema>;

export const realtimeIncidentUpdateMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  action: realtimeIncidentUpdateActionSchema,
  incident: realtimeIncidentSchema,
  occurredAt: z.string().datetime(),
});

export type RealtimeIncidentUpdateMessage = z.infer<typeof realtimeIncidentUpdateMessageSchema>;

export const realtimeTelemetryEventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum(["log", "error", "metric"]),
  source: z.string().min(1),
  level: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  name: z.string().min(1).nullable(),
  value: z.number().finite().nullable(),
  unit: z.string().min(1).nullable(),
  fingerprint: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
});

export type RealtimeTelemetryEvent = z.infer<typeof realtimeTelemetryEventSchema>;

export const realtimeEventCreatedMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  event: realtimeTelemetryEventSchema,
  occurredAt: z.string().datetime(),
});

export type RealtimeEventCreatedMessage = z.infer<typeof realtimeEventCreatedMessageSchema>;

export const realtimeWorkerMetricsSchema = z.object({
  processed: z.number().int().min(0),
  processedByType: z.object({
    log: z.number().int().min(0),
    error: z.number().int().min(0),
    metric: z.number().int().min(0),
  }),
  failed: z.number().int().min(0),
  retries: z.number().int().min(0),
  poisonMessages: z.number().int().min(0),
  lastProcessedAt: z.string().datetime().nullable(),
  lastErrorAt: z.string().datetime().nullable(),
  lastErrorMessage: z.string().nullable(),
});

export const realtimeWorkerHeartbeatMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  worker: z.object({
    workerId: z.string().min(1),
    service: z.string().min(1),
    status: z.enum(["running", "stopping", "stopped"]),
    queues: z.array(z.string().min(1)),
    metrics: realtimeWorkerMetricsSchema,
    startedAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
  }),
  occurredAt: z.string().datetime(),
});

export type RealtimeWorkerHeartbeatMessage = z.infer<typeof realtimeWorkerHeartbeatMessageSchema>;

export const realtimeQueueStatusMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  queues: z.array(
    z.object({
      name: z.string().min(1),
      status: z.enum(["available", "missing"]),
      messageCount: z.number().int().min(0).nullable(),
      consumerCount: z.number().int().min(0).nullable(),
    }),
  ),
  occurredAt: z.string().datetime(),
});

export type RealtimeQueueStatusMessage = z.infer<typeof realtimeQueueStatusMessageSchema>;

export const realtimeVaultAuditEventSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1),
  projectId: z.string().min(1),
  actorType: z.enum(["user", "integration", "service"]),
  actorId: z.string().min(1),
  action: z.string().min(1),
  result: z.enum(["success", "failure"]),
  environment: z.string().min(1).nullable(),
  secretKey: z.string().min(1).nullable(),
  tokenPrefix: z.string().min(1).nullable(),
  reason: z.string().min(1).nullable(),
  correlationId: z.string().min(1),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RealtimeVaultAuditEvent = z.infer<typeof realtimeVaultAuditEventSchema>;

export const realtimeVaultAuditCreatedMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  auditEvent: realtimeVaultAuditEventSchema,
  occurredAt: z.string().datetime(),
});

export type RealtimeVaultAuditCreatedMessage = z.infer<
  typeof realtimeVaultAuditCreatedMessageSchema
>;
