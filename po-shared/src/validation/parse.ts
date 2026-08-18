import { ZodError, type ZodType } from "zod";
import { AppError } from "../errors/index.js";

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
};

export function formatZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function parseWithSchema<TOutput>(schema: ZodType<TOutput>, value: unknown): TOutput {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw new AppError({
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    statusCode: 400,
    details: formatZodIssues(result.error),
  });
}
