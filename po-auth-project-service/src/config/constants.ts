export const SERVICE_NAME = "po-auth-project-service";

export const TOKEN_LIMITS = {
  issuer: "pulseops.auth-project-service",
  audience: "pulseops.dashboard",
  accessTokenTtlSeconds: 60 * 60,
} as const;

export const PASSWORD_HASHING = {
  keyLength: 64,
  saltBytes: 16,
  scrypt: {
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
    maxMemory: 64 * 1024 * 1024,
  },
} as const;

export const USER_LIMITS = {
  nameMaxLength: 80,
  passwordMinLength: 8,
  passwordMaxLength: 128,
} as const;

export const OAUTH_LIMITS = {
  providers: ["google", "github"],
  stateTtlSeconds: 5 * 60,
  stateNonceBytes: 16,
} as const;

export const PROJECT_LIMITS = {
  nameMaxLength: 100,
  slugMaxLength: 80,
} as const;

export const API_KEY_LIMITS = {
  nameMaxLength: 80,
  rawKeyBytes: 32,
  prefixLength: 16,
  defaultScopes: ["logs:write", "errors:write", "metrics:write"] as const,
} as const;
