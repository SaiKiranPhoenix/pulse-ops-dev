import { z } from "zod";

export const hostStatusSchema = z.enum(["healthy", "degraded", "offline"]);
export const containerStatusSchema = z.enum(["running", "restarting", "stopped", "unhealthy"]);
export const dependencyStatusSchema = z.enum(["healthy", "degraded", "unreachable"]);

export const hostStatsReportSchema = z.object({
  hostname: z.string().min(1).max(128),
  ipAddress: z.string().min(1).max(64),
  os: z.string().min(1).max(64),
  arch: z.string().min(1).max(32),
  cpuCores: z.number().int().positive(),
  memoryTotalMb: z.number().int().positive(),
  diskTotalGb: z.number().positive(),
  tags: z.record(z.string(), z.string()).optional(),
  cpuPercent: z.number().min(0).max(100),
  memoryPercent: z.number().min(0).max(100),
  diskPercent: z.number().min(0).max(100),
  networkRxKbps: z.number().nonnegative(),
  networkTxKbps: z.number().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
});

export const containerStatsReportSchema = z.object({
  containerId: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  image: z.string().min(1).max(256),
  serviceName: z.string().min(1).max(128),
  hostId: z.string().min(1).max(64),
  status: containerStatusSchema,
  cpuPercent: z.number().min(0).max(100),
  memoryUsageMb: z.number().nonnegative(),
  memoryLimitMb: z.number().positive(),
  networkRxKbps: z.number().nonnegative(),
  networkTxKbps: z.number().nonnegative(),
  restartCount: z.number().int().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
  ports: z.array(z.string()).optional(),
});
