import type { RequestHandler } from "express";
import { unauthorized } from "@pulseops/shared";

export function createApiKeyPresenceMiddleware(): RequestHandler {
  return (request, _response, next) => {
    const apiKey = request.header("x-api-key")?.trim();

    if (apiKey === undefined || apiKey.length === 0) {
      throw unauthorized("API key is required");
    }

    next();
  };
}
