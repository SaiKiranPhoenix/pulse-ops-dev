import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource id");

export const serviceQuerySchema = z.object({
  projectId: objectIdSchema,
});

export const serviceParamsSchema = z.object({
  serviceName: z.string().trim().min(1).max(120),
});

export const upsertServiceBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  ownerName: z.string().trim().max(120).nullable().optional(),
  ownerEmail: z.string().trim().email().max(320).nullable().optional(),
  ownerTeam: z.string().trim().max(120).nullable().optional(),
  language: z
    .enum(["nodejs", "python", "go", "java", "rust", "csharp", "ruby", "other"])
    .optional(),
  runtime: z
    .enum(["docker", "kubernetes", "lambda", "baremetal", "cloud_run", "ecs", "other"])
    .optional(),
  tier: z.enum(["tier_1", "tier_2", "tier_3"]).optional(),
  repoUrl: z.string().trim().url().max(1000).nullable().optional(),
  runbookUrl: z.string().trim().url().max(1000).nullable().optional(),
  deploymentUrl: z.string().trim().url().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  onboardingChecklist: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        completed: z.boolean(),
        completedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .optional(),
  status: z.enum(["active", "discovered", "archived"]).optional(),
});

export type ServiceQuery = z.infer<typeof serviceQuerySchema>;
export type ServiceParams = z.infer<typeof serviceParamsSchema>;
export type UpsertServiceBody = z.infer<typeof upsertServiceBodySchema>;
