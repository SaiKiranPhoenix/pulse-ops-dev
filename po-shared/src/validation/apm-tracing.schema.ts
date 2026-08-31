import { z } from "zod";

export const spanKindSchema = z.enum(["server", "client", "producer", "consumer", "internal"]);
export const spanStatusCodeSchema = z.enum(["ok", "error", "unset"]);

export const spanEventSchema = z.object({
  name: z.string().min(1).max(128),
  timestamp: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const spanBodySchema = z.object({
  traceId: z.string().min(1).max(64),
  spanId: z.string().min(1).max(32),
  parentSpanId: z.string().max(32).optional(),
  name: z.string().min(1).max(256),
  kind: spanKindSchema.default("server"),
  serviceName: z.string().min(1).max(128),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMs: z.number().nonnegative(),
  statusCode: spanStatusCodeSchema.default("ok"),
  statusMessage: z.string().max(1024).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  events: z.array(spanEventSchema).optional(),
});

export const traceBodySchema = z.object({
  traceId: z.string().min(1).max(64),
  rootSpanName: z.string().min(1).max(256),
  serviceName: z.string().min(1).max(128),
  startTime: z.string().min(1),
  durationMs: z.number().nonnegative(),
  spans: z.array(spanBodySchema).min(1),
  hasError: z.boolean().default(false),
});
