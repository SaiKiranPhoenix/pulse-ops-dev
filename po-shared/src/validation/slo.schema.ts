import { z } from "zod";

export const sliTypeSchema = z.enum(["availability", "latency", "error_rate", "custom_metric"]);

export const sliDefinitionSchema = z.object({
  type: sliTypeSchema,
  serviceName: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  thresholdMs: z.number().positive().optional(),
  metricName: z.string().trim().optional(),
  goodEventFilter: z.string().trim().optional(),
  totalEventFilter: z.string().trim().optional(),
});

export const sloTargetSchema = z.object({
  targetPercent: z.number().min(80.0).max(99.999),
  warningPercent: z.number().min(80.0).max(99.999).optional(),
  rollingWindowDays: z.number().int().min(1).max(365).default(30),
});

export const createSloBodySchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  sli: sliDefinitionSchema,
  target: sloTargetSchema,
  tags: z.array(z.string().trim()).optional().default([]),
  enabled: z.boolean().optional().default(true),
});

export const updateSloBodySchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  sli: sliDefinitionSchema.optional(),
  target: sloTargetSchema.optional(),
  tags: z.array(z.string().trim()).optional(),
  enabled: z.boolean().optional(),
});

export const sloListQuerySchema = z.object({
  serviceName: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  status: z.enum(["compliant", "at_risk", "breached"]).optional(),
  enabled: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
});
