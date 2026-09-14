import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4200),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  VAULT_MASTER_PASSWORD: z.string().min(16),
  VAULT_TOKEN_PEPPER: z.string().min(16),
});

export type VaultServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): VaultServiceEnv {
  return envSchema.parse(source);
}
