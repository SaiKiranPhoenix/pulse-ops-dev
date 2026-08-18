import { z } from "zod";
import { API_KEY_LIMITS, PROJECT_LIMITS } from "../config/constants.js";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource id");

export const projectParamsSchema = z.object({
  projectId: objectIdSchema,
});

export const apiKeyParamsSchema = z.object({
  projectId: objectIdSchema,
  apiKeyId: objectIdSchema,
});

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_LIMITS.nameMaxLength),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(PROJECT_LIMITS.slugMaxLength)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens")
    .optional(),
});

export const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(API_KEY_LIMITS.nameMaxLength),
  scopes: z
    .array(z.enum(API_KEY_LIMITS.defaultScopes))
    .max(API_KEY_LIMITS.defaultScopes.length)
    .optional(),
  expiresAt: z.coerce.date().min(new Date()).nullable().optional(),
});

export type ProjectParams = z.infer<typeof projectParamsSchema>;
export type ApiKeyParams = z.infer<typeof apiKeyParamsSchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
