import type { NextFunction, Request, Response } from "express";
import { parseWithSchema } from "@pulseops/shared";
import type { ZodType } from "zod";

export function validateBody<TBody>(schema: ZodType<TBody>) {
  return (request: Request, response: Response, next: NextFunction) => {
    response.locals.validatedBody = parseWithSchema(schema, request.body);
    next();
  };
}
