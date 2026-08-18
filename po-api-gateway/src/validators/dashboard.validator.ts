import { z } from "zod";

export const projectQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
});

export type ProjectQuery = z.infer<typeof projectQuerySchema>;
