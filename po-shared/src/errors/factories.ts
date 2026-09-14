import { AppError, type ErrorDetails } from "./app-error.js";

function withDetails(details: ErrorDetails | undefined) {
  return details === undefined ? {} : { details };
}

export function badRequest(message = "Bad request", details?: ErrorDetails) {
  return new AppError({ code: "BAD_REQUEST", message, statusCode: 400, ...withDetails(details) });
}

export function unauthorized(message = "Authentication required", details?: ErrorDetails) {
  return new AppError({ code: "UNAUTHORIZED", message, statusCode: 401, ...withDetails(details) });
}

export function forbidden(message = "Forbidden", details?: ErrorDetails) {
  return new AppError({ code: "FORBIDDEN", message, statusCode: 403, ...withDetails(details) });
}

export function notFound(message = "Resource not found", details?: ErrorDetails) {
  return new AppError({ code: "NOT_FOUND", message, statusCode: 404, ...withDetails(details) });
}

export function conflict(message = "Conflict", details?: ErrorDetails) {
  return new AppError({ code: "CONFLICT", message, statusCode: 409, ...withDetails(details) });
}

export function rateLimited(message = "Rate limit exceeded", details?: ErrorDetails) {
  return new AppError({ code: "RATE_LIMITED", message, statusCode: 429, ...withDetails(details) });
}

export function dependencyUnavailable(message = "Dependency unavailable", details?: ErrorDetails) {
  return new AppError({
    code: "DEPENDENCY_UNAVAILABLE",
    message,
    statusCode: 503,
    ...withDetails(details),
  });
}
