import type { RequestHandler } from "express";
import { unauthorized } from "@pulseops/shared";

export function createAuthMiddleware(): RequestHandler {
  return (request, response, next) => {
    const userId = request.header("x-user-id")?.trim();

    if (userId === undefined || userId.length === 0) {
      throw unauthorized("Authentication required");
    }

    response.locals.auth = { userId };
    next();
  };
}
