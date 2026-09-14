import { z } from "zod";

export const vaultCapabilitySchema = z.enum([
  "create",
  "read",
  "update",
  "delete",
  "list",
  "deny",
  "sudo",
]);

export const vaultPolicyRuleSchema = z.object({
  path: z.string().min(1).max(255),
  capabilities: z.array(vaultCapabilitySchema).min(1),
  description: z.string().max(500).optional(),
});

export const createVaultPolicySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  rules: z.array(vaultPolicyRuleSchema).min(1),
  isDefault: z.boolean().optional(),
});

export const updateVaultPolicySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  rules: z.array(vaultPolicyRuleSchema).min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const policySimulationSchema = z.object({
  path: z.string().min(1),
  capability: vaultCapabilitySchema,
  policyIds: z.array(z.string()).optional(),
  environment: z.string().optional(),
  userRole: z.string().optional(),
});

export const secretMetadataConfigSchema = z.object({
  maxVersions: z.number().int().min(1).max(100).optional(),
  casRequired: z.boolean().optional(),
  deleteProtection: z.boolean().optional(),
  customMetadata: z.record(z.string(), z.string()).optional(),
  expiresAt: z.string().optional(),
  ttlSeconds: z.number().int().min(60).optional(),
  rotationPeriodDays: z.number().int().min(1).max(365).optional(),
  nextRotationDate: z.string().optional(),
  autoRotateEnabled: z.boolean().optional(),
});

export const dynamicDbCredentialRequestSchema = z.object({
  engine: z.enum(["postgres", "mysql", "mongodb"]),
  role: z.string().min(1).max(64).default("readonly"),
  ttlSeconds: z.number().int().min(60).max(86400).default(3600),
});

export const transitEncryptRequestSchema = z.object({
  keyName: z.string().min(1).max(64),
  plaintext: z.string().min(1),
});

export const transitDecryptRequestSchema = z.object({
  keyName: z.string().min(1).max(64),
  ciphertext: z.string().min(1),
});
