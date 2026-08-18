export const SERVICE_NAME = "po-auth-project-service";

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
  passwordMinLength: 12,
  passwordMaxLength: 128,
} as const;
