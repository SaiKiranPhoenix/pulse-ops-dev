import { z } from "zod";

export const TELEMETRY_EXCHANGE = "pulseops.telemetry.x";

export const telemetryEventTypeSchema = z.enum(["log", "error", "metric"]);
export type TelemetryEventType = z.infer<typeof telemetryEventTypeSchema>;

export const TELEMETRY_ROUTING_KEYS: Record<TelemetryEventType, string> = {
  log: "telemetry.log.v1",
  error: "telemetry.error.v1",
  metric: "telemetry.metric.v1",
};

export const TELEMETRY_QUEUES: Record<TelemetryEventType, string> = {
  log: "pulseops.logs.q",
  error: "pulseops.errors.q",
  metric: "pulseops.metrics.q",
};

export const DEAD_LETTER_EXCHANGE = "pulseops.dlx";
export const DEAD_LETTER_QUEUE = "pulseops.dead-letter.q";

export const telemetryEventMessageSchema = z.object({
  messageId: z.string().min(1),
  schemaVersion: z.literal(1),
  type: telemetryEventTypeSchema,
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1).nullable(),
  source: z.string().min(1),
  level: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  name: z.string().min(1).nullable(),
  value: z.number().finite().nullable(),
  unit: z.string().min(1).nullable(),
  fingerprint: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
  observedAt: z.string().datetime(),
  acceptedAt: z.string().datetime(),
});

export type TelemetryEventMessage = z.infer<typeof telemetryEventMessageSchema>;
