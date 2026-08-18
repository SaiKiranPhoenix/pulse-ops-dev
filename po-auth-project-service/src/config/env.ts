import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4010),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  JWT_SECRET: z.string().min(32),
  API_KEY_PEPPER: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).optional(),
});

export type AuthProjectServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AuthProjectServiceEnv {
  return envSchema.parse(source);
}
