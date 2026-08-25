import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource id");

export const incidentListQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
});

export const incidentParamsSchema = z.object({
  incidentId: objectIdSchema,
});

export const resolveIncidentBodySchema = z
  .object({
    resolutionNote: z.string().trim().min(1).max(1_000).optional(),
  })
  .default({});

export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
export type IncidentParams = z.infer<typeof incidentParamsSchema>;
export type ResolveIncidentBody = z.infer<typeof resolveIncidentBodySchema>;
