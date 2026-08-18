import type { NextFunction, Request, Response } from "express";
import { parseWithSchema } from "@pulseops/shared";
import type { ZodType } from "zod";

export function validateParams<TParams>(schema: ZodType<TParams>) {
  return (request: Request, response: Response, next: NextFunction) => {
    response.locals.validatedParams = parseWithSchema(schema, request.params);
    next();
  };
}

export function validateQuery<TQuery>(schema: ZodType<TQuery>) {
  return (request: Request, response: Response, next: NextFunction) => {
    response.locals.validatedQuery = parseWithSchema(schema, request.query);
    next();
  };
}
