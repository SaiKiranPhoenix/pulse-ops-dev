import { randomUUID } from "node:crypto";
import type { PulseOpsClient } from "../client.js";
import type { ExpressMiddlewareOptions } from "../types.js";

// Type definitions matching standard Express middleware signatures without hard dependency
export type ExpressRequest = {
  method: string;
  url: string;
  originalUrl?: string;
  path?: string;
  baseUrl?: string;
  route?: { path?: string };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  [key: string]: unknown;
};

export type ExpressResponse = {
  statusCode: number;
  getHeader(name: string): string | number | string[] | undefined;
  setHeader(name: string, value: string | number | readonly string[]): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  [key: string]: unknown;
};

export type ExpressNextFunction = (err?: unknown) => void;

export function createPulseOpsMiddleware(
  client: PulseOpsClient,
  options?: ExpressMiddlewareOptions,
) {
  const reqIdHeader = (options?.headerRequestId ?? "x-request-id").toLowerCase();
  const corrIdHeader = (options?.headerCorrelationId ?? "x-correlation-id").toLowerCase();

  return function pulseOpsExpressMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: ExpressNextFunction,
  ) {
    const rawReqId = req.headers[reqIdHeader];
    const requestId = typeof rawReqId === "string" ? rawReqId : randomUUID();

    const rawCorrId = req.headers[corrIdHeader];
    const correlationId = typeof rawCorrId === "string" ? rawCorrId : requestId;

    res.setHeader(reqIdHeader, requestId);
    res.setHeader(corrIdHeader, correlationId);

    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
      const pathname = req.path || req.url || "/";
      if (options?.ignorePath && options.ignorePath(pathname)) {
        return;
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Extract matched route pattern if available (e.g. /api/users/:id)
      const routePath = req.route?.path
        ? `${req.baseUrl || ""}${req.route.path}`
        : req.baseUrl || req.path || req.url || "/";

      const statusCode = res.statusCode || 200;
      const logLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

      const customAttributes = options?.extractAttributes
        ? options.extractAttributes(req, res)
        : {};

      const attributes = {
        method: req.method,
        path: routePath,
        rawUrl: req.originalUrl || req.url,
        statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        requestId,
        correlationId,
        ip:
          req.ip ||
          (typeof req.headers["x-forwarded-for"] === "string"
            ? req.headers["x-forwarded-for"]
            : undefined),
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        ...customAttributes,
      };

      client.log(
        logLevel,
        `HTTP ${req.method} ${routePath} ${statusCode} - ${Math.round(durationMs)}ms`,
        attributes,
      );

      client.timing("http_request_duration_ms", durationMs, {
        method: req.method,
        route: routePath,
        status: String(statusCode),
      });

      client.increment("http_requests_total", 1, {
        method: req.method,
        route: routePath,
        status: String(statusCode),
      });
    });

    next();
  };
}

export function createPulseOpsErrorHandler(client: PulseOpsClient) {
  return function pulseOpsExpressErrorHandler(
    err: unknown,
    req: ExpressRequest,
    _res: ExpressResponse,
    next: ExpressNextFunction,
  ) {
    const requestId = req.headers["x-request-id"];
    const correlationId = req.headers["x-correlation-id"];

    client.error(err, {
      method: req.method,
      path: req.originalUrl || req.url,
      requestId: typeof requestId === "string" ? requestId : undefined,
      correlationId: typeof correlationId === "string" ? correlationId : undefined,
    });

    next(err);
  };
}
