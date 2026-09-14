import { z } from "zod";

export const dashboardWidgetTypeSchema = z.enum([
  "timeseries",
  "toplist",
  "table",
  "query_value",
  "incident_list",
  "log_stream",
  "markdown",
]);

export const dashboardGridPosSchema = z.object({
  x: z.number().int().min(0).max(12),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
});

export const dashboardWidgetConfigSchema = z.object({
  metricName: z.string().trim().optional(),
  serviceName: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  queryFilter: z.string().trim().optional(),
  timeRange: z.string().trim().optional(),
  chartType: z.enum(["line", "area", "bar"]).optional(),
  unit: z.string().trim().optional(),
  markdownContent: z.string().trim().optional(),
  topLimit: z.number().int().positive().optional(),
  groupBy: z.string().trim().optional(),
});

export const dashboardWidgetSchema = z.object({
  id: z.string().trim(),
  type: dashboardWidgetTypeSchema,
  title: z.string().trim().min(1).max(100),
  gridPos: dashboardGridPosSchema,
  config: dashboardWidgetConfigSchema,
});

export const createCustomDashboardBodySchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  templateKey: z.string().trim().optional(),
  widgets: z.array(dashboardWidgetSchema).default([]),
  tags: z.array(z.string().trim()).optional().default([]),
  refreshIntervalSeconds: z.number().int().min(5).max(3600).default(30),
  isDefault: z.boolean().optional().default(false),
});

export const updateCustomDashboardBodySchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  templateKey: z.string().trim().optional(),
  widgets: z.array(dashboardWidgetSchema).optional(),
  tags: z.array(z.string().trim()).optional(),
  refreshIntervalSeconds: z.number().int().min(5).max(3600).optional(),
  isDefault: z.boolean().optional(),
});

export const queryExplorerQuerySchema = z.object({
  queryType: z.enum(["logs", "metrics", "errors"]).default("logs"),
  serviceName: z.string().trim().optional(),
  environment: z.string().trim().optional(),
  severity: z.string().trim().optional(),
  searchTerm: z.string().trim().optional(),
  timeRangeMinutes: z.coerce.number().int().positive().default(60),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
