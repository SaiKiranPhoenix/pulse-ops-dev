import { describe, expect, it } from "vitest";
import {
  ActiveSpan,
  formatW3CTraceParent,
  generateSpanId,
  generateTraceId,
  parseW3CTraceParent,
  withSpan,
} from "../../src/tracing.js";

describe("W3C TraceContext & Distributed Tracing Helpers", () => {
  it("generates compliant 32-hex traceId and 16-hex spanId", () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    expect(traceId).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);

    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  it("formats and parses standard W3C traceparent headers", () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";

    const header = formatW3CTraceParent(traceId, spanId, true);
    expect(header).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

    const parsed = parseW3CTraceParent(header);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe("00");
    expect(parsed?.traceId).toBe(traceId);
    expect(parsed?.parentId).toBe(spanId);
    expect(parsed?.traceFlags).toBe("01");
  });

  it("rejects invalid or malformed traceparent headers", () => {
    expect(parseW3CTraceParent("")).toBeNull();
    expect(parseW3CTraceParent("invalid-header")).toBeNull();
    expect(parseW3CTraceParent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")).toBeNull();
    expect(parseW3CTraceParent("00-00000000000000000000000000000000-00f067aa0ba902b7-01")).toBeNull();
  });

  it("creates active spans and records status, errors, and timing", () => {
    const span = new ActiveSpan("http.request", {
      serviceName: "checkout-service",
      attributes: { "http.method": "POST" },
    });

    span.setAttribute("http.status_code", 200);
    span.setStatus("ok");

    const payload = span.end();
    expect(payload.name).toBe("http.request");
    expect(payload.serviceName).toBe("checkout-service");
    expect(payload.statusCode).toBe("ok");
    expect(payload.attributes?.["http.method"]).toBe("POST");
    expect(payload.attributes?.["http.status_code"]).toBe(200);
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("executes withSpan and captures successful results", async () => {
    const { result, span } = await withSpan(
      "db.query",
      { serviceName: "postgres-client" },
      async (s) => {
        s.setAttribute("db.table", "users");
        return { count: 42 };
      },
    );

    expect(result.count).toBe(42);
    expect(span.name).toBe("db.query");
    expect(span.statusCode).toBe("ok");
    expect(span.attributes?.["db.table"]).toBe("users");
  });

  it("executes withSpan and captures errors with stack traces", async () => {
    await expect(
      withSpan("failing.operation", undefined, async () => {
        throw new Error("Simulated network timeout");
      }),
    ).rejects.toThrow("Simulated network timeout");
  });
});
