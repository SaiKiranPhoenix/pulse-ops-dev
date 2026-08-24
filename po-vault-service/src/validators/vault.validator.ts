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

export const vaultTokenParamsSchema = z.object({
  tokenId: z.string().trim().min(1).max(128),
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

export const revealSecretBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  vaultPassword: z.string().min(1).max(256),
});

export const createVaultTokenBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(VAULT_LIMITS.tokenNameMaxLength),
  scopes: z.array(z.string().trim().min(1).max(80)).optional(),
  environments: z.array(z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength)).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const tokenFetchParamsSchema = secretParamsSchema;

export type SecretQuery = z.infer<typeof secretQuerySchema>;
export type SecretParams = z.infer<typeof secretParamsSchema>;
export type VaultTokenParams = z.infer<typeof vaultTokenParamsSchema>;
export type CreateSecretBody = z.infer<typeof createSecretBodySchema>;
export type UpdateSecretBody = z.infer<typeof updateSecretBodySchema>;
export type RevealSecretBody = z.infer<typeof revealSecretBodySchema>;
export type CreateVaultTokenBody = z.infer<typeof createVaultTokenBodySchema>;
