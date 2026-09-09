import { z } from "zod";

export const auditListQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  action: z.string().trim().min(1).max(120).optional(),
  result: z.enum(["success", "failure"]).optional(),
  environment: z.string().trim().min(1).max(80).optional(),
  secretKey: z.string().trim().min(1).max(120).optional(),
  actor: z.string().trim().min(1).max(128).optional(),
  occurredAfter: z.string().datetime().optional(),
  occurredBefore: z.string().datetime().optional(),
});

export const auditReportQuerySchema = auditListQuerySchema.pick({
  projectId: true,
  occurredAfter: true,
  occurredBefore: true,
});

export const auditIntegrityQuerySchema = auditListQuerySchema.pick({
  projectId: true,
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type AuditReportQuery = z.infer<typeof auditReportQuerySchema>;
export type AuditIntegrityQuery = z.infer<typeof auditIntegrityQuerySchema>;
