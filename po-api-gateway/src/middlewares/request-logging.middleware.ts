import type { NextFunction, Request, Response } from "express";
import type { Logger } from "@pulseops/shared";

export function createRequestLoggingMiddleware(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const metadata = {
        method: request.method,
        path: request.originalUrl,
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
