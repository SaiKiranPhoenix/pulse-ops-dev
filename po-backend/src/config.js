import process from "node:process";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  JWT_SECRET: z.string().min(32),
  API_KEY_PEPPER: z.string().min(16),
  VAULT_MASTER_PASSWORD: z.string().min(16),
  VAULT_TOKEN_PEPPER: z.string().min(16),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(600),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  WORKER_ID: z.string().optional(),
  WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
  WORKER_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),
  WORKER_HEARTBEAT_TTL_SECONDS: z.coerce.number().int().min(1).max(600).default(30),
  INCIDENT_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
  AUDIT_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
  REALTIME_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
});

export function loadMonolithEnv(source = process.env) {
  return envSchema.parse(source);
}

export function parseAllowedOrigins(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
