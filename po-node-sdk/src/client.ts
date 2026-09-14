import { Redactor } from "./redactor.js";
import type { LogLevel, PulseOpsOptions, QueuedIngestItem } from "./types.js";

const DEFAULT_BATCH_SIZE = 30;
const DEFAULT_FLUSH_INTERVAL_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 5000;

export class PulseOpsClient {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly serviceName: string;
  readonly environment: string;
  readonly batchSize: number;
  readonly flushIntervalMs: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly disabled: boolean;
  readonly isDebug: boolean;

  private readonly redactor: Redactor;
  private queue: QueuedIngestItem[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private isClosed = false;

  constructor(options: PulseOpsOptions) {
    if (!options.apiKey && !options.disabled) {
      throw new Error("[PulseOps SDK] apiKey is required. Provide an ingestion API key.");
    }

    this.apiKey = options.apiKey || "";
    this.endpoint = (
      options.endpoint ??
      process.env.PULSEOPS_ENDPOINT ??
      "http://localhost:4000"
    ).replace(/\/+$/, "");
    this.serviceName = options.serviceName ?? process.env.SERVICE_NAME ?? "unnamed-service";
    this.environment = options.environment ?? process.env.NODE_ENV ?? "development";
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.disabled = options.disabled ?? false;
    this.isDebug = options.debug ?? false;

    this.redactor = new Redactor(options.redactionKeys, options.redactionPatterns);

    if (!this.disabled) {
      this.startFlushTimer();
      this.registerProcessHooks();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush().catch((err) => {
        if (this.isDebug) {
          console.error("[PulseOps SDK] Background flush error:", err);
        }
      });
    }, this.flushIntervalMs);

    if (typeof this.flushTimer.unref === "function") {
      this.flushTimer.unref();
    }
  }

  private registerProcessHooks(): void {
    const handleExit = () => {
      void this.flush().catch(() => {});
    };

    process.once("beforeExit", handleExit);
    process.once("SIGTERM", () => {
      void this.flush().finally(() => process.exit(0));
    });
    process.once("SIGINT", () => {
      void this.flush().finally(() => process.exit(0));
    });
  }

  private enqueue(type: "log" | "metric" | "error", payload: Record<string, unknown>): void {
    if (this.disabled || this.isClosed) return;

    const sanitizedPayload = this.redactor.redactObject({
      source: this.serviceName,
      ...payload,
      attributes: {
        environment: this.environment,
        service: this.serviceName,
        ...(payload.attributes ? (payload.attributes as Record<string, unknown>) : {}),
      },
    });

    this.queue.push({
      type,
      payload: sanitizedPayload as Record<string, unknown>,
      addedAt: Date.now(),
      retries: 0,
    });

    if (this.queue.length >= this.batchSize) {
      void this.flush().catch((err) => {
        if (this.isDebug) {
          console.error("[PulseOps SDK] Batch threshold flush error:", err);
        }
      });
    }
  }

  log(
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>,
    timestamp?: Date | string,
  ): void {
    const observedAt = timestamp
      ? typeof timestamp === "string"
        ? timestamp
        : timestamp.toISOString()
      : new Date().toISOString();

    this.enqueue("log", {
      level,
      message,
      attributes: attributes ?? {},
      timestamp: observedAt,
    });
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log("debug", message, attributes);
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    this.log("info", message, attributes);
  }

  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log("warn", message, attributes);
  }

  error(
    errOrMessage: Error | string | unknown,
    attributes?: Record<string, unknown>,
    timestamp?: Date | string,
  ): void {
    const observedAt = timestamp
      ? typeof timestamp === "string"
        ? timestamp
        : timestamp.toISOString()
      : new Date().toISOString();

    let message = "Unknown error";
    let stack: string | undefined;
    let name = "Error";

    if (errOrMessage instanceof Error) {
      message = errOrMessage.message;
      stack = errOrMessage.stack;
      name = errOrMessage.name;
    } else if (typeof errOrMessage === "string") {
      message = errOrMessage;
    } else if (errOrMessage && typeof errOrMessage === "object") {
      message = JSON.stringify(errOrMessage);
    }

    this.enqueue("error", {
      message,
      level: "error",
      name,
      stack,
      attributes: attributes ?? {},
      timestamp: observedAt,
    });
  }

  metric(
    name: string,
    value: number,
    unit?: string,
    attributes?: Record<string, unknown>,
    timestamp?: Date | string,
  ): void {
    const observedAt = timestamp
      ? typeof timestamp === "string"
        ? timestamp
        : timestamp.toISOString()
      : new Date().toISOString();

    this.enqueue("metric", {
      name,
      value: Number(value),
      unit: unit ?? "count",
      attributes: attributes ?? {},
      timestamp: observedAt,
    });
  }

  timing(name: string, durationMs: number, attributes?: Record<string, unknown>): void {
    this.metric(name, durationMs, "ms", attributes);
  }

  increment(name: string, count = 1, attributes?: Record<string, unknown>): void {
    this.metric(name, count, "count", attributes);
  }

  gauge(name: string, value: number, attributes?: Record<string, unknown>): void {
    this.metric(name, value, "gauge", attributes);
  }

  async flush(): Promise<void> {
    if (this.disabled || this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const itemsToSend = this.queue.splice(0, this.batchSize * 2);

    const logs: QueuedIngestItem[] = [];
    const metrics: QueuedIngestItem[] = [];
    const errors: QueuedIngestItem[] = [];

    for (const item of itemsToSend) {
      if (item.type === "log") logs.push(item);
      else if (item.type === "metric") metrics.push(item);
      else if (item.type === "error") errors.push(item);
    }

    const failedItems: QueuedIngestItem[] = [];

    try {
      await Promise.all([
        this.sendBatch("/ingest/logs", logs, failedItems),
        this.sendBatch("/ingest/metrics", metrics, failedItems),
        this.sendBatch("/ingest/errors", errors, failedItems),
      ]);
    } finally {
      // Requeue failed items if retry count not exceeded
      if (failedItems.length > 0) {
        const retryable = failedItems
          .filter((item) => item.retries < this.maxRetries)
          .map((item) => {
            item.retries += 1;
            return item;
          });
        this.queue.unshift(...retryable);
      }
      this.isFlushing = false;
    }
  }

  private async sendBatch(
    path: string,
    items: QueuedIngestItem[],
    failedSink: QueuedIngestItem[],
  ): Promise<void> {
    if (items.length === 0) return;

    const url = `${this.endpoint}${path}`;

    for (const item of items) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
          body: JSON.stringify(item.payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            failedSink.push(item);
          } else if (this.isDebug) {
            console.error(`[PulseOps SDK] Request to ${url} failed with status ${res.status}`);
          }
        }
      } catch (err) {
        failedSink.push(item);
        if (this.isDebug) {
          console.error(`[PulseOps SDK] Network error posting to ${url}:`, err);
        }
      }
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
