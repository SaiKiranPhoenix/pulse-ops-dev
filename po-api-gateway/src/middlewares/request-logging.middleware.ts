import type { NextFunction, Request, Response } from "express";
import { isSensitiveKey, redactString, redactedValue, type Logger } from "@pulseops/shared";

export function createRequestLoggingMiddleware(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const metadata = {
        method: request.method,
        path: sanitizePath(request.originalUrl),
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs),
        requestHeaders: pickLoggableHeaders(request.headers),
        requestId: response.locals.requestId,
      };

      if (response.statusCode >= 500) {
        logger.warn("Gateway request completed", metadata);
        return;
      }

      logger.info("Gateway request completed", metadata);
    });

    next();
  };
}

function sanitizePath(originalUrl: string): string {
  const [path = "/", queryString] = originalUrl.split("?", 2);

  if (queryString === undefined || queryString.length === 0) {
    return path;
  }

  const searchParams = new URLSearchParams(queryString);

  for (const [key, value] of searchParams.entries()) {
    searchParams.set(key, isSensitiveKey(key) ? redactedValue : redactString(value));
  }

  return `${path}?${searchParams.toString()}`;
}

function pickLoggableHeaders(headers: Request["headers"]): Record<string, string> {
  const selectedHeaders = ["content-type", "user-agent", "x-request-id", "x-forwarded-for"];

  return Object.fromEntries(
    selectedHeaders
      .map((headerName) => {
        const value = headers[headerName];
        return [headerName, Array.isArray(value) ? value.join(",") : value] as const;
      })
      .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"),
  );
}
