import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4010),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
});

export type AuthProjectServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AuthProjectServiceEnv {
  return envSchema.parse(source);
}
