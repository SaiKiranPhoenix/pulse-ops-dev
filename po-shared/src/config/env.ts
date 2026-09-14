import { z, type ZodRawShape } from "zod";
import { parseWithSchema } from "../validation/index.js";

export const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const baseServiceEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().max(65535),
  MONGODB_URI: z.string().url().or(z.string().startsWith("mongodb://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  RABBITMQ_URL: z.string().url().or(z.string().startsWith("amqp://")),
  JWT_SECRET: z.string().min(16),
});

export type BaseServiceEnv = z.infer<typeof baseServiceEnvSchema>;

export function buildEnvSchema<TShape extends ZodRawShape>(shape: TShape) {
  return baseServiceEnvSchema.extend(shape);
}

export function loadEnv<TOutput>(schema: z.ZodType<TOutput>, source = process.env): TOutput {
  return parseWithSchema(schema, source);
}
