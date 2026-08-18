import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4120),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
});

export type IncidentServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): IncidentServiceEnv {
  return envSchema.parse(source);
}
