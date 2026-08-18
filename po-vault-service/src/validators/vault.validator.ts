import { z } from "zod";
import { VAULT_LIMITS } from "../config/constants.js";

export const secretQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  environment: z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength).optional(),
});

export const secretParamsSchema = z.object({
  environment: z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength),
  key: z.string().trim().min(1).max(VAULT_LIMITS.keyMaxLength),
});

export const createSecretBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  environment: z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength),
  key: z.string().trim().min(1).max(VAULT_LIMITS.keyMaxLength),
  value: z.string().min(1).max(VAULT_LIMITS.secretMaxLength),
});

export const updateSecretBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  value: z.string().min(1).max(VAULT_LIMITS.secretMaxLength),
});

export type SecretQuery = z.infer<typeof secretQuerySchema>;
export type SecretParams = z.infer<typeof secretParamsSchema>;
export type CreateSecretBody = z.infer<typeof createSecretBodySchema>;
export type UpdateSecretBody = z.infer<typeof updateSecretBodySchema>;
