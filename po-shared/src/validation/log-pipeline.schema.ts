import { z } from "zod";

export const logProcessorTypeSchema = z.enum([
  "parse_json",
  "remap_fields",
  "redact_regex",
  "drop_filter",
  "sample_rate",
  "add_tags",
]);

export const logProcessorConfigSchema = z.object({
  sourceField: z.string().optional(),
  targetField: z.string().optional(),
  fieldMappings: z.record(z.string(), z.string()).optional(),
  redactionPatterns: z.array(z.string()).optional(),
  redactionReplacement: z.string().optional(),
  dropFilter: z.string().optional(),
  sampleRatePercent: z.number().min(0).max(100).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

export const logPipelineProcessorSchema = z.object({
  id: z.string().min(1),
  type: logProcessorTypeSchema,
  name: z.string().min(1),
  enabled: z.boolean(),
  config: logProcessorConfigSchema,
});

export const createLogPipelineRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
  processors: z.array(logPipelineProcessorSchema).default([]),
});

export const updateLogPipelineRuleSchema = createLogPipelineRuleSchema.partial();

export const updateLogRetentionSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(365),
  coldArchiveEnabled: z.boolean().default(false),
  coldArchiveBucket: z.string().optional(),
});

export const createSavedLogSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1),
  serviceFilter: z.string().optional(),
  levelFilter: z.string().optional(),
  environment: z.string().optional(),
  timeframe: z.string().default("15m"),
});

export type CreateLogPipelineRuleInput = z.infer<typeof createLogPipelineRuleSchema>;
export type UpdateLogPipelineRuleInput = z.infer<typeof updateLogPipelineRuleSchema>;
export type UpdateLogRetentionSettingsInput = z.infer<typeof updateLogRetentionSettingsSchema>;
export type CreateSavedLogSearchInput = z.infer<typeof createSavedLogSearchSchema>;
