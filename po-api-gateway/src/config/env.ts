import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  JWT_SECRET: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  AUTH_PROJECT_SERVICE_URL: z.string().url().default("http://po-auth-project-service:4010"),
  AUDIT_SERVICE_URL: z.string().url().default("http://po-audit-service:4140"),
  INGESTION_SERVICE_URL: z.string().url().default("http://po-ingestion-service:4100"),
  INCIDENT_SERVICE_URL: z.string().url().default("http://po-incident-service:4120"),
  OPS_SERVICE_URL: z.string().url().default("http://po-ops-service:4150"),
  VAULT_SERVICE_URL: z.string().url().default("http://po-vault-service:4200"),
});

export type ApiGatewayEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiGatewayEnv {
  return envSchema.parse(source);
}
