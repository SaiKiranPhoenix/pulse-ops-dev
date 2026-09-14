import type { NextFunction, Request, RequestHandler, Response } from "express";

const allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const allowedHeaders = "Authorization,Content-Type,Idempotency-Key,X-Api-Key,X-Request-Id";
const maxAgeSeconds = "600";

export function createCorsMiddleware(allowedOrigins: string): RequestHandler {
  const origins = parseAllowedOrigins(allowedOrigins);

  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header("origin");

    if (origin !== undefined && origins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Methods", allowedMethods);
      response.setHeader("Access-Control-Allow-Headers", allowedHeaders);
      response.setHeader("Access-Control-Max-Age", maxAgeSeconds);
    }

    if (request.method.toUpperCase() === "OPTIONS") {
      response.status(origin !== undefined && origins.has(origin) ? 204 : 403).end();
      return;
    }

    next();
  };
}

function parseAllowedOrigins(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}
