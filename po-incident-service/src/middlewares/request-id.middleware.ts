import type { NextFunction, Request, Response } from "express";
import { createRequestId } from "@pulseops/shared";

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.locals.requestId = request.header("x-request-id") ?? createRequestId();
  next();
}
