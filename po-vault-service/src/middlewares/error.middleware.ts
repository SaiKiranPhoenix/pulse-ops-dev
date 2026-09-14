import type { ErrorRequestHandler } from "express";
import { errorResponse, toAppError, type Logger } from "@pulseops/shared";

export function createErrorMiddleware(logger: Logger): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    const appError = toAppError(error);
    const requestId = String(response.locals.requestId ?? "unknown");
    const metadata = {
      requestId,
      code: appError.code,
      statusCode: appError.statusCode,
      isOperational: appError.isOperational,
    };

    if (appError.statusCode >= 500) {
      logger.error(appError.message, { ...metadata, error: appError });
    } else {
      logger.warn(appError.message, metadata);
    }

    response.status(appError.statusCode).json(
      errorResponse({
        code: appError.code,
        message: appError.message,
        requestId,
        ...(appError.details === undefined ? {} : { details: appError.details }),
      }),
    );
  };
}
