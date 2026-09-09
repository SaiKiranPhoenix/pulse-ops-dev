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

export const vaultAuthMethodParamsSchema = z.object({
  authMethodId: z.string().trim().min(1).max(128),
});

export const vaultLeaseParamsSchema = z.object({
  leaseId: z.string().trim().min(1).max(160),
});

export const bundleFetchParamsSchema = z.object({
  environment: z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength),
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
  ttlSeconds: z.number().int().min(60).max(VAULT_LIMITS.absoluteTokenMaxTtlSeconds).optional(),
  maxTtlSeconds: z.number().int().min(60).max(VAULT_LIMITS.absoluteTokenMaxTtlSeconds).optional(),
  renewable: z.boolean().optional(),
});

export const createVaultAuthMethodBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  type: z.enum(["service-account", "approle"]),
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().trim().min(1).max(80)).optional(),
  environments: z.array(z.string().trim().min(1).max(VAULT_LIMITS.environmentMaxLength)).optional(),
  ttlSeconds: z.number().int().min(60).max(VAULT_LIMITS.absoluteTokenMaxTtlSeconds).optional(),
  maxTtlSeconds: z.number().int().min(60).max(VAULT_LIMITS.absoluteTokenMaxTtlSeconds).optional(),
  renewable: z.boolean().optional(),
});

export const appRoleLoginBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  roleId: z.string().trim().min(1).max(128),
  secretId: z.string().trim().min(1).max(256),
});

export const tokenFetchParamsSchema = secretParamsSchema;

export type SecretQuery = z.infer<typeof secretQuerySchema>;
export type SecretParams = z.infer<typeof secretParamsSchema>;
export type VaultTokenParams = z.infer<typeof vaultTokenParamsSchema>;
export type VaultAuthMethodParams = z.infer<typeof vaultAuthMethodParamsSchema>;
export type VaultLeaseParams = z.infer<typeof vaultLeaseParamsSchema>;
export type BundleFetchParams = z.infer<typeof bundleFetchParamsSchema>;
export type CreateSecretBody = z.infer<typeof createSecretBodySchema>;
export type UpdateSecretBody = z.infer<typeof updateSecretBodySchema>;
export type RevealSecretBody = z.infer<typeof revealSecretBodySchema>;
export type CreateVaultTokenBody = z.infer<typeof createVaultTokenBodySchema>;
export type CreateVaultAuthMethodBody = z.infer<typeof createVaultAuthMethodBodySchema>;
export type AppRoleLoginBody = z.infer<typeof appRoleLoginBodySchema>;
