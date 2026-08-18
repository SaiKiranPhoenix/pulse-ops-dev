import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  JWT_SECRET: z.string().min(32),
});

export type ApiGatewayEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiGatewayEnv {
  return envSchema.parse(source);
}
