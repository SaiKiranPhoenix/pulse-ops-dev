import crypto from "node:crypto";
import type { SpanKind, SpanPayload, SpanStatusCode, W3CTraceContext } from "@pulseops/shared";

/**
 * Generate a 32-character hexadecimal W3C Trace ID (128-bit)
 */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a 16-character hexadecimal W3C Span ID (64-bit)
 */
export function generateSpanId(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Format a W3C TraceContext traceparent header: `00-${traceId}-${spanId}-${flags}`
 */
export function formatW3CTraceParent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? "01" : "00";
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Parse a standard W3C TraceContext traceparent header
 */
export function parseW3CTraceParent(header: string): W3CTraceContext | null {
  if (!header || typeof header !== "string") return null;

  const parts = header.trim().split("-");
  if (parts.length < 4) return null;

  const [version, traceId, parentId, traceFlags] = parts;
  if (!version || !traceId || !parentId || !traceFlags) return null;
  if (version !== "00") return null;
  if (traceId.length !== 32 || traceId === "00000000000000000000000000000000") return null;
  if (parentId.length !== 16 || parentId === "0000000000000000") return null;

  return {
    version,
    traceId,
    parentId,
    traceFlags,
  };
}

export interface SpanOptions {
  readonly traceId?: string;
  readonly parentSpanId?: string;
  readonly kind?: SpanKind;
  readonly serviceName?: string;
  readonly attributes?: Record<string, unknown>;
}

export class ActiveSpan {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly name: string;
  public readonly kind: SpanKind;
  public readonly serviceName: string;
  public readonly startTime: number;
  private readonly attributes: Record<string, unknown>;
  private statusCode: SpanStatusCode = "ok";
  private statusMessage?: string;
  private endTime?: number;

  constructor(name: string, options?: SpanOptions) {
    this.name = name;
    this.traceId = options?.traceId || generateTraceId();
    this.spanId = generateSpanId();
    if (options?.parentSpanId !== undefined) {
      this.parentSpanId = options.parentSpanId;
    }
    this.kind = options?.kind || "server";
    this.serviceName = options?.serviceName || "unnamed-service";
    this.startTime = Date.now();
    this.attributes = { ...(options?.attributes || {}) };
  }

  public setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  public setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.attributes, attrs);
    return this;
  }

  public setStatus(code: SpanStatusCode, message?: string): this {
    this.statusCode = code;
    if (message !== undefined) {
      this.statusMessage = message;
    }
    return this;
  }

  public recordError(error: Error | string): this {
    this.statusCode = "error";
    this.statusMessage = typeof error === "string" ? error : error.message;
    this.setAttribute("error.type", typeof error === "string" ? "Error" : error.name);
    this.setAttribute("error.message", typeof error === "string" ? error : error.message);
    if (error instanceof Error && error.stack) {
      this.setAttribute("error.stack", error.stack);
    }
    return this;
  }

  public end(): SpanPayload {
    this.endTime = Date.now();
    const durationMs = Math.max(0, this.endTime - this.startTime);

    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      serviceName: this.serviceName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(this.endTime).toISOString(),
      durationMs,
      statusCode: this.statusCode,
      statusMessage: this.statusMessage,
      attributes: this.attributes,
    };
  }

  public getTraceParent(): string {
    return formatW3CTraceParent(this.traceId, this.spanId);
  }
}

/**
 * Execute an async operation within an active distributed span
 */
export async function withSpan<T>(
  name: string,
  options: SpanOptions | undefined,
  fn: (span: ActiveSpan) => Promise<T>,
): Promise<{ result: T; span: SpanPayload }> {
  const span = new ActiveSpan(name, options);
  try {
    const result = await fn(span);
    const payload = span.end();
    return { result, span: payload };
  } catch (err) {
    span.recordError(err instanceof Error ? err : String(err));
    const payload = span.end();
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      _pulseops_span: payload,
    });
  }
}
