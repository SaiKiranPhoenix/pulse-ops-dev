import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
  WORKER_ID: z.string().trim().min(1).optional(),
  WORKER_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),
  WORKER_HEARTBEAT_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
});

export type EventWorkersEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): EventWorkersEnv {
  return envSchema.parse(source);
}
