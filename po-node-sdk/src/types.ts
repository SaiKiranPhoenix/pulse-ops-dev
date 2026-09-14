export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type PulseOpsOptions = {
  /**
   * Ingestion API Key generated in PulseOps Project Settings
   */
  readonly apiKey: string;

  /**
   * Target PulseOps API Gateway endpoint (e.g. http://localhost:4000 or https://api.pulseops.dev)
   * Defaults to process.env.PULSEOPS_ENDPOINT or http://localhost:4000
   */
  readonly endpoint?: string;

  /**
   * Logical service identifier (e.g. "checkout-api", "billing-worker")
   * Defaults to process.env.SERVICE_NAME or "unnamed-service"
   */
  readonly serviceName?: string;

  /**
   * Environment name (e.g. "production", "staging", "development")
   * Defaults to process.env.NODE_ENV or "development"
   */
  readonly environment?: string;

  /**
   * Maximum events to batch in a single HTTP payload (default: 30)
   */
  readonly batchSize?: number;

  /**
   * Flush interval in milliseconds (default: 2000ms)
   */
  readonly flushIntervalMs?: number;

  /**
   * Max retry attempts for transient network or 5xx/429 errors (default: 3)
   */
  readonly maxRetries?: number;

  /**
   * Request timeout in milliseconds (default: 5000ms)
   */
  readonly timeoutMs?: number;

  /**
   * Sensitive key substrings to automatically mask in attributes and payloads
   */
  readonly redactionKeys?: string[];

  /**
   * Custom Regex patterns to redact in string values
   */
  readonly redactionPatterns?: RegExp[];

  /**
   * If true, SDK operations are no-ops (useful in unit tests or local development)
   */
  readonly disabled?: boolean;

  /**
   * Enable verbose internal SDK logging to console
   */
  readonly debug?: boolean;
};

export type LogPayload = {
  readonly level: LogLevel;
  readonly message: string;
  readonly attributes?: Record<string, unknown>;
  readonly timestamp?: Date | string;
};

export type MetricPayload = {
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly attributes?: Record<string, unknown>;
  readonly timestamp?: Date | string;
};

export type ErrorPayload = {
  readonly error: Error | unknown;
  readonly message?: string;
  readonly level?: LogLevel;
  readonly attributes?: Record<string, unknown>;
  readonly timestamp?: Date | string;
};

export type QueuedIngestItem = {
  readonly type: "log" | "metric" | "error";
  readonly payload: Record<string, unknown>;
  readonly addedAt: number;
  retries: number;
};

export type ExpressMiddlewareOptions = {
  /**
   * Header name for request tracking (default: "x-request-id")
   */
  readonly headerRequestId?: string;

  /**
   * Header name for correlation tracking (default: "x-correlation-id")
   */
  readonly headerCorrelationId?: string;

  /**
   * Path filter to exclude healthchecks (e.g. req => req.path === "/health")
   */
  readonly ignorePath?: (path: string) => boolean;

  /**
   * Extract custom attributes from request/response
   */
  readonly extractAttributes?: (req: unknown, res: unknown) => Record<string, unknown>;
};
