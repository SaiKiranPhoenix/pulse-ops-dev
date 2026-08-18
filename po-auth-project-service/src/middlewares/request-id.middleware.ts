import type { NextFunction, Request, Response } from "express";
import { createRequestId } from "@pulseops/shared";

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const headerValue = request.header("x-request-id");
  response.locals.requestId = headerValue?.trim() || createRequestId();
  response.setHeader("x-request-id", response.locals.requestId);
  next();
}
