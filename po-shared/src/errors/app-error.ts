export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ErrorDetails = Record<string, unknown> | readonly unknown[];

export type AppErrorOptions = {
  readonly code: ErrorCode;
  readonly message: string;
  readonly statusCode: number;
  readonly details?: ErrorDetails;
  readonly cause?: unknown;
  readonly isOperational?: boolean;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: ErrorDetails | undefined;
  readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  return new AppError({
    code: "INTERNAL_ERROR",
    message: "Unexpected internal error",
    statusCode: 500,
    cause: error,
    isOperational: false,
  });
}
