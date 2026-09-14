import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4140),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  AUDIT_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
});

export type AuditServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AuditServiceEnv {
  return envSchema.parse(source);
}
