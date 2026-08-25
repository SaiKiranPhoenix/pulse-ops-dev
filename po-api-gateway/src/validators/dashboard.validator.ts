import { z } from "zod";

export const projectQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
});

export const dashboardEventsQuerySchema = projectQuerySchema.extend({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ProjectQuery = z.infer<typeof projectQuerySchema>;
export type DashboardEventsQuery = z.infer<typeof dashboardEventsQuerySchema>;
