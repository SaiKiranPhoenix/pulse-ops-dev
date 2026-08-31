export type SpanKind = "server" | "client" | "producer" | "consumer" | "internal";

export type SpanStatusCode = "ok" | "error" | "unset";

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: string;
  readonly attributes?: Record<string, unknown> | undefined;
}

export interface SpanPayload {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string | undefined;
  readonly name: string;
  readonly kind: SpanKind;
  readonly serviceName: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly statusCode: SpanStatusCode;
  readonly statusMessage?: string | undefined;
  readonly attributes?: Record<string, unknown> | undefined;
  readonly events?: SpanEvent[] | undefined;
}

export interface TracePayload {
  readonly traceId: string;
  readonly rootSpanName: string;
  readonly serviceName: string;
  readonly startTime: string;
  readonly durationMs: number;
  readonly spans: SpanPayload[];
  readonly hasError: boolean;
}

export interface W3CTraceContext {
  readonly version: string;
  readonly traceId: string;
  readonly parentId: string;
  readonly traceFlags: string;
}
