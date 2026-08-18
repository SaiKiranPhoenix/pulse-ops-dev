import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource id");

export const incidentListQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  status: z.enum(["open", "resolved"]).optional(),
});

export const incidentParamsSchema = z.object({
  incidentId: objectIdSchema,
});

export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
export type IncidentParams = z.infer<typeof incidentParamsSchema>;
