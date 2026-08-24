import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4150),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
});

export type OpsServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): OpsServiceEnv {
  return envSchema.parse(source);
}
