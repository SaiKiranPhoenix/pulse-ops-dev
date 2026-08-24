import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4130),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  JWT_SECRET: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  REALTIME_WORKER_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
});

export type RealtimeGatewayEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): RealtimeGatewayEnv {
  return envSchema.parse(source);
}

export function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
