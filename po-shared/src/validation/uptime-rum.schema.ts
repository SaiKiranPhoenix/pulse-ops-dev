import { z } from "zod";

export const uptimeCheckStatusSchema = z.enum(["up", "down", "degraded", "paused"]);
export const httpMethodSchema = z.enum(["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"]);

export const assertionTypeSchema = z.enum([
  "status_code",
  "response_time",
  "body_contains",
  "header_matches",
]);

export const assertionOperatorSchema = z.enum([
  "equals",
  "less_than",
  "greater_than",
  "contains",
  "regex",
]);

export const syntheticAssertionSchema = z.object({
  type: assertionTypeSchema,
  target: z.string().min(1).max(256),
  operator: assertionOperatorSchema,
  expectedValue: z.union([z.string(), z.number()]),
});

export const createUptimeCheckSchema = z.object({
  name: z.string().min(1).max(128),
  url: z.string().url().max(1024),
  method: httpMethodSchema.default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(8192).optional(),
  intervalSeconds: z.number().int().min(10).max(3600).default(60),
  timeoutMs: z.number().int().min(500).max(30000).default(5000),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  syntheticAssertions: z.array(syntheticAssertionSchema).optional(),
});

export const updateUptimeCheckSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  url: z.string().url().max(1024).optional(),
  method: httpMethodSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(8192).optional(),
  intervalSeconds: z.number().int().min(10).max(3600).optional(),
  timeoutMs: z.number().int().min(500).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).optional(),
  syntheticAssertions: z.array(syntheticAssertionSchema).optional(),
  status: uptimeCheckStatusSchema.optional(),
});

export const ingestRumEventSchema = z.object({
  sessionId: z.string().min(1).max(64),
  pageUrl: z.string().url().max(1024),
  pageTitle: z.string().max(256).optional(),
  lcpMs: z.number().nonnegative().optional(),
  fidMs: z.number().nonnegative().optional(),
  cls: z.number().nonnegative().optional(),
  fcpMs: z.number().nonnegative().optional(),
  ttfbMs: z.number().nonnegative().optional(),
  device: z.enum(["desktop", "mobile", "tablet"]).default("desktop"),
  browser: z.string().max(64).default("Chrome"),
  os: z.string().max(64).default("Windows"),
  country: z.string().max(64).optional(),
});
