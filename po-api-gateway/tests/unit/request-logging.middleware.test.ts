import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { Logger, LogMetadata } from "@pulseops/shared";
import { createRequestLoggingMiddleware } from "../../src/middlewares/request-logging.middleware.js";

class CapturingLogger implements Logger {
  readonly entries: Array<{ readonly message: string; readonly metadata?: LogMetadata }> = [];

  debug(): void {}

  info(message: string, metadata?: LogMetadata): void {
    this.entries.push({ message, metadata });
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.entries.push({ message, metadata });
  }

  error(): void {}

  child(): Logger {
    return this;
  }
}

describe("createRequestLoggingMiddleware", () => {
  it("logs safe request metadata without sensitive headers", () => {
    const logger = new CapturingLogger();
    const response = new EventEmitter() as Response;
    response.statusCode = 200;
    response.locals = { requestId: "req_1" };
    const request = {
      method: "POST",
      originalUrl: "/vault/secrets",
      headers: {
        authorization: "Bearer raw-token",
        "x-vault-token": "raw-vault-token",
        "content-type": "application/json",
        "x-request-id": "req_1",
      },
    } as unknown as Request;
    const next: NextFunction = () => {};

    createRequestLoggingMiddleware(logger)(request, response, next);
    response.emit("finish");

    expect(JSON.stringify(logger.entries)).not.toContain("raw-token");
    expect(JSON.stringify(logger.entries)).not.toContain("raw-vault-token");
    expect(logger.entries[0]?.metadata).toMatchObject({
      method: "POST",
      path: "/vault/secrets",
      statusCode: 200,
      requestHeaders: {
        "content-type": "application/json",
        "x-request-id": "req_1",
      },
    });
  });
});
