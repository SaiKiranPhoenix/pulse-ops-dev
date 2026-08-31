import { z } from "zod";

export const metricTypeSchema = z.enum(["counter", "gauge", "histogram", "summary"]);

export const metricRollupAggregationSchema = z.enum([
  "count",
  "avg",
  "sum",
  "min",
  "max",
  "p50",
  "p95",
  "p99",
]);

export const metricTimeBucketSchema = z.enum(["10s", "1m", "5m", "15m", "1h", "1d"]);

export const createMetricDefinitionBodySchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.\-]+$/, "Invalid metric name format"),
  type: metricTypeSchema,
  unit: z.string().max(32).optional(),
  description: z.string().max(512).optional(),
  tagKeys: z.array(z.string().min(1).max(64)).optional().default([]),
  cardinalityLimit: z.number().int().positive().max(100000).optional().default(1000),
  retentionDays: z.number().int().positive().max(730).optional().default(30),
});

export const updateMetricDefinitionBodySchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.\-]+$/).optional(),
  type: metricTypeSchema.optional(),
  unit: z.string().max(32).optional(),
  description: z.string().max(512).optional(),
  tagKeys: z.array(z.string().min(1).max(64)).optional(),
  cardinalityLimit: z.number().int().positive().max(100000).optional(),
  retentionDays: z.number().int().positive().max(730).optional(),
});

export const metricQuerySchema = z.object({
  metricName: z.string().min(1),
  aggregation: metricRollupAggregationSchema.default("avg"),
  timeBucket: metricTimeBucketSchema.default("1m"),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  groupBy: z.string().optional(),
});
