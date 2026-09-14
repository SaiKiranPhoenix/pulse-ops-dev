import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  API_KEY_PEPPER: z.string().min(32),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(600),
});

export type IngestionServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): IngestionServiceEnv {
  return envSchema.parse(source);
}
