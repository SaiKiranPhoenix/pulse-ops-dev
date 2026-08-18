import { inspect } from "node:util";
import { createCorrelationId, redact } from "../security/index.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LoggerContext = {
  readonly service: string;
  readonly correlationId?: string;
  readonly requestId?: string;
};

export type LogMetadata = Record<string, unknown>;

export type Logger = {
  readonly debug: (message: string, metadata?: LogMetadata) => void;
  readonly info: (message: string, metadata?: LogMetadata) => void;
  readonly warn: (message: string, metadata?: LogMetadata) => void;
  readonly error: (message: string, metadata?: LogMetadata) => void;
  readonly child: (context: Partial<LoggerContext>) => Logger;
};

export function createLogger(context: LoggerContext): Logger {
  const baseContext = {
    ...context,
    correlationId: context.correlationId ?? createCorrelationId(),
  };

  function write(level: LogLevel, message: string, metadata: LogMetadata = {}) {
    const entry = redact({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...baseContext,
      metadata,
    });

    const serialized = JSON.stringify(entry);

    if (level === "error") {
      console.error(serialized);
      return;
    }

    if (level === "warn") {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }

  return {
    debug: (message, metadata) => write("debug", message, metadata),
    info: (message, metadata) => write("info", message, metadata),
    warn: (message, metadata) => write("warn", message, metadata),
    error: (message, metadata) => write("error", message, normalizeErrorMetadata(metadata)),
    child: (nextContext) => createLogger({ ...baseContext, ...nextContext }),
  };
}

function normalizeErrorMetadata(metadata: LogMetadata = {}): LogMetadata {
  const error = metadata.error;

  if (!(error instanceof Error)) {
    return metadata;
  }

  return {
    ...metadata,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause === undefined ? undefined : inspect(error.cause),
    },
  };
}
