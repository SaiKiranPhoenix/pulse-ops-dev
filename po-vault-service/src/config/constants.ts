export const SERVICE_NAME = "po-vault-service";

export const VAULT_LIMITS = {
  keyMaxLength: 120,
  environmentMaxLength: 80,
  tokenNameMaxLength: 80,
  secretMaxLength: 32_000,
  bodyLimit: "512kb",
  rawTokenBytes: 32,
  tokenPrefixLength: 16,
  defaultTokenScopes: ["secrets:read"] as const,
  defaultTokenTtlSeconds: 60 * 60,
  defaultTokenMaxTtlSeconds: 24 * 60 * 60,
  absoluteTokenMaxTtlSeconds: 7 * 24 * 60 * 60,
  secretReadLimit: 30,
  secretReadWindowMs: 60_000,
  failedRevealLimit: 5,
  failedRevealWindowMs: 5 * 60_000,
} as const;

export const VAULT_CRYPTO = {
  algorithm: "aes-256-gcm",
  keyLength: 32,
  ivLength: 12,
  saltLength: 16,
  tagLength: 16,
  scryptCost: 16_384,
  scryptBlockSize: 8,
  scryptParallelization: 1,
  scryptMaxMemory: 64 * 1024 * 1024,
} as const;
