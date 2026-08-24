import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  response.locals.requestId = request.header("x-request-id") ?? `req_${randomUUID()}`;
  next();
};
