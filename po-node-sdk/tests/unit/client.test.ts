import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PulseOpsClient } from "../../src/client.js";
import { Redactor } from "../../src/redactor.js";
import {
  createPulseOpsErrorHandler,
  createPulseOpsMiddleware,
} from "../../src/middleware/express.js";
import { instrumentJob } from "../../src/helpers/jobs.js";
import { initPulseOps, getPulseOpsClient } from "../../src/index.js";
import type { PulseOpsRequest, PulseOpsResponse } from "../../src/types.js";

describe("PulseOps Node SDK", () => {
  describe("Redactor", () => {
    it("redacts sensitive keys in objects recursively", () => {
      const redactor = new Redactor();
      const input = {
        user: "alice",
        password: "SuperSecretPassword123!",
        apiKey: "pk_live_abcdef123456",
        nested: {
          authToken: "bearer 9999",
          normalField: "public-value",
        },
      };

      const redacted = redactor.redactObject(input);
      expect(redacted.user).toBe("alice");
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.apiKey).toBe("[REDACTED]");
      expect(redacted.nested.authToken).toBe("[REDACTED]");
      expect(redacted.nested.normalField).toBe("public-value");
    });

    it("redacts JWTs and Bearer tokens in raw strings", () => {
      const redactor = new Redactor();
      const rawText =
        "Connecting with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis and extra data";
      const result = redactor.redactString(rawText);

      expect(result).not.toContain("eyJhbGci");
      expect(result).toContain("[REDACTED_JWT]");
    });

    it("handles circular references gracefully", () => {
      const redactor = new Redactor();
      const circular: Record<string, unknown> = { name: "test" };
      circular.self = circular;

      const result = redactor.redactObject(circular);
      expect(result.name).toBe("test");
      expect(result.self).toBe("[CIRCULAR]");
    });
  });

  describe("PulseOpsClient", () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({ accepted: true }),
      });
      vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it("initializes with default options and singleton helper", () => {
      const client = initPulseOps({
        apiKey: "test-api-key",
        serviceName: "checkout-api",
        environment: "production",
      });

      expect(client.apiKey).toBe("test-api-key");
      expect(client.serviceName).toBe("checkout-api");
      expect(client.environment).toBe("production");
      expect(getPulseOpsClient()).toBe(client);
    });

    it("enqueues and flushes logs, metrics, and errors via HTTP", async () => {
      const client = new PulseOpsClient({
        apiKey: "pk_test_12345",
        endpoint: "http://test-gateway.local",
        serviceName: "payment-service",
        batchSize: 100,
        flushIntervalMs: 60000,
      });

      client.info("Order processed successfully", { orderId: "ord_999" });
      client.timing("order_duration_ms", 125, { orderId: "ord_999" });
      client.error(new Error("Database connection lost"), { dbHost: "db.local" });

      await client.flush();

      expect(mockFetch).toHaveBeenCalledTimes(3);

      const paths = mockFetch.mock.calls.map((c) => c[0]);
      expect(paths).toContain("http://test-gateway.local/ingest/logs");
      expect(paths).toContain("http://test-gateway.local/ingest/metrics");
      expect(paths).toContain("http://test-gateway.local/ingest/errors");

      // Verify headers
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["x-api-key"]).toBe("pk_test_12345");
      expect(headers["content-type"]).toBe("application/json");

      await client.close();
    });

    it("handles disabled mode as a no-op", async () => {
      const client = new PulseOpsClient({
        apiKey: "",
        disabled: true,
      });

      client.info("This should not be enqueued");
      client.metric("test_metric", 42);
      await client.flush();

      expect(mockFetch).not.toHaveBeenCalled();
      await client.close();
    });
  });

  describe("Express Middleware", () => {
    it("propagates correlation IDs and records request duration metrics", () => {
      const client = new PulseOpsClient({
        apiKey: "test-key",
        disabled: true,
      });
      const logSpy = vi.spyOn(client, "log");
      const timingSpy = vi.spyOn(client, "timing");
      const incrementSpy = vi.spyOn(client, "increment");

      const middleware = createPulseOpsMiddleware(client);

      const req = {
        method: "POST",
        url: "/api/orders/123",
        path: "/api/orders/123",
        headers: { "x-correlation-id": "corr_custom_999" },
        route: { path: "/api/orders/:id" },
        baseUrl: "",
      } as unknown as PulseOpsRequest;

      const setHeaderMock = vi.fn();
      let finishCallback: () => void = () => {};

      const res = {
        statusCode: 201,
        setHeader: setHeaderMock,
        getHeader: vi.fn(),
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "finish") finishCallback = cb;
        }),
      } as unknown as PulseOpsResponse;

      const next = vi.fn();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith("x-correlation-id", "corr_custom_999");
      expect(setHeaderMock).toHaveBeenCalledWith("x-request-id", expect.any(String));

      // Trigger finish
      finishCallback();

      expect(logSpy).toHaveBeenCalledWith(
        "info",
        expect.stringContaining("HTTP POST /api/orders/:id 201"),
        expect.objectContaining({
          method: "POST",
          path: "/api/orders/:id",
          statusCode: 201,
          correlationId: "corr_custom_999",
        }),
      );

      expect(timingSpy).toHaveBeenCalledWith(
        "http_request_duration_ms",
        expect.any(Number),
        expect.objectContaining({
          method: "POST",
          route: "/api/orders/:id",
          status: "201",
        }),
      );

      expect(incrementSpy).toHaveBeenCalledWith(
        "http_requests_total",
        1,
        expect.objectContaining({
          method: "POST",
          route: "/api/orders/:id",
          status: "201",
        }),
      );
    });

    it("captures unhandled errors in error handler middleware", () => {
      const client = new PulseOpsClient({
        apiKey: "test-key",
        disabled: true,
      });
      const errorSpy = vi.spyOn(client, "error");

      const errorHandler = createPulseOpsErrorHandler(client);
      const testError = new Error("Something blew up!");

      const req = {
        method: "GET",
        url: "/api/crash",
        headers: { "x-request-id": "req_123", "x-correlation-id": "corr_456" },
      } as unknown as PulseOpsRequest;
      const res = {} as unknown as PulseOpsResponse;
      const next = vi.fn();

      errorHandler(testError, req, res, next);

      expect(errorSpy).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          method: "GET",
          path: "/api/crash",
          requestId: "req_123",
          correlationId: "corr_456",
        }),
      );
      expect(next).toHaveBeenCalledWith(testError);
    });
  });

  describe("Job Instrumentation", () => {
    it("measures successful async job execution duration and records metrics", async () => {
      const client = new PulseOpsClient({
        apiKey: "test-key",
        disabled: true,
      });
      const timingSpy = vi.spyOn(client, "timing");
      const incrementSpy = vi.spyOn(client, "increment");

      const result = await instrumentJob(
        client,
        "send_welcome_email",
        async () => {
          return { sent: true };
        },
        { queueName: "emails" },
      );

      expect(result).toEqual({ sent: true });
      expect(timingSpy).toHaveBeenCalledWith("job_duration_ms", expect.any(Number), {
        jobName: "send_welcome_email",
        queueName: "emails",
        status: "success",
      });
      expect(incrementSpy).toHaveBeenCalledWith("job_executions_total", 1, {
        jobName: "send_welcome_email",
        queueName: "emails",
        status: "success",
      });
    });

    it("captures and logs failed job executions before rethrowing", async () => {
      const client = new PulseOpsClient({
        apiKey: "test-key",
        disabled: true,
      });
      const errorSpy = vi.spyOn(client, "error");
      const incrementSpy = vi.spyOn(client, "increment");

      const jobError = new Error("SMTP server unreachable");

      await expect(
        instrumentJob(
          client,
          "sync_inventory",
          async () => {
            throw jobError;
          },
          { queueName: "inventory" },
        ),
      ).rejects.toThrow("SMTP server unreachable");

      expect(errorSpy).toHaveBeenCalledWith(
        jobError,
        expect.objectContaining({
          jobName: "sync_inventory",
          queueName: "inventory",
          status: "failed",
        }),
      );
      expect(incrementSpy).toHaveBeenCalledWith("job_errors_total", 1, {
        jobName: "sync_inventory",
        queueName: "inventory",
      });
    });
  });
});
