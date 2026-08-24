import { z } from "zod";

const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4010),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  JWT_SECRET: z.string().min(32),
  API_KEY_PEPPER: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).optional(),
  OAUTH_STATE_SECRET: optionalNonEmptyString.pipe(z.string().min(32).optional()),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).optional(),
  OAUTH_CALLBACK_BASE_URL: z.string().url().default("http://localhost:4000"),
  OAUTH_SUCCESS_REDIRECT_URL: z.string().url().default("http://localhost:3000/oauth/callback"),
  OAUTH_FAILURE_REDIRECT_URL: z.string().url().default("http://localhost:3000/login"),
  OAUTH_GOOGLE_CLIENT_ID: optionalNonEmptyString,
  OAUTH_GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  OAUTH_GITHUB_CLIENT_ID: optionalNonEmptyString,
  OAUTH_GITHUB_CLIENT_SECRET: optionalNonEmptyString,
});

export type AuthProjectServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AuthProjectServiceEnv {
  return envSchema.parse(source);
}
