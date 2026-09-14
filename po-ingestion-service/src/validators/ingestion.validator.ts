import { z } from "zod";
import { INGESTION_LIMITS } from "../config/constants.js";

const attributesSchema = z.record(z.string().min(1).max(80), z.unknown()).optional();

const baseEventSchema = z.object({
  source: z.string().trim().min(1).max(160).default("default"),
  fingerprint: z.string().trim().min(1).max(256).optional(),
  attributes: attributesSchema,
  timestamp: z.coerce.date().optional(),
});

export const logBodySchema = baseEventSchema.extend({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  message: z.string().trim().min(1).max(INGESTION_LIMITS.messageMaxLength),
});

export const errorBodySchema = baseEventSchema.extend({
  name: z.string().trim().min(1).max(INGESTION_LIMITS.nameMaxLength).default("Error"),
  message: z.string().trim().min(1).max(INGESTION_LIMITS.messageMaxLength),
  stack: z.string().max(INGESTION_LIMITS.stackMaxLength).optional(),
});

export const metricBodySchema = baseEventSchema.extend({
  name: z.string().trim().min(1).max(INGESTION_LIMITS.nameMaxLength),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(40).optional(),
});

export type LogBody = z.infer<typeof logBodySchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type MetricBody = z.infer<typeof metricBodySchema>;
