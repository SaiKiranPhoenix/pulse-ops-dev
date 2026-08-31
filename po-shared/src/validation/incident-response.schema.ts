import { z } from "zod";

export const incidentSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const relatedResourceTypeSchema = z.enum([
  "log",
  "trace",
  "metric",
  "service",
  "monitor",
  "runbook",
]);

export const triageIncidentSchema = z.object({
  severity: incidentSeveritySchema.optional(),
  assignee: z.string().max(128).optional(),
  runbookUrl: z.string().url().max(1024).optional(),
});

export const addIncidentCommentSchema = z.object({
  message: z.string().min(1).max(4096),
  userId: z.string().max(64).optional(),
  userName: z.string().max(128).optional(),
});

export const addRelatedResourceSchema = z.object({
  type: relatedResourceTypeSchema,
  title: z.string().min(1).max(256),
  url: z.string().min(1).max(1024),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const postmortemReportSchema = z.object({
  summary: z.string().min(1).max(4096),
  rootCause: z.string().min(1).max(4096),
  trigger: z.string().min(1).max(2048),
  impactDurationMinutes: z.number().nonnegative(),
  detectionTimeMinutes: z.number().nonnegative(),
  resolutionTimeMinutes: z.number().nonnegative(),
  actionItems: z.array(
    z.object({
      id: z.string().min(1),
      description: z.string().min(1).max(1024),
      assignee: z.string().max(128).optional(),
      completed: z.boolean().default(false),
    }),
  ),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const onCallRotationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  type: z.enum(["daily", "weekly", "custom"]).default("weekly"),
  participants: z.array(z.string().min(1)).min(1),
  activeParticipant: z.string().min(1),
  shiftStart: z.string().min(1),
});

export const createOnCallScheduleSchema = z.object({
  name: z.string().min(1).max(128),
  timezone: z.string().max(64).default("UTC"),
  rotations: z.array(onCallRotationSchema).optional(),
  activeOnCallUser: z.string().max(128).default("sre-lead@pulseops.dev"),
});

export const escalationStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  delayMinutes: z.number().int().nonnegative(),
  targetType: z.enum(["user", "schedule", "channel"]),
  targetId: z.string().min(1).max(128),
});

export const createEscalationPolicySchema = z.object({
  name: z.string().min(1).max(128),
  steps: z.array(escalationStepSchema).min(1),
  isDefault: z.boolean().default(false),
});
