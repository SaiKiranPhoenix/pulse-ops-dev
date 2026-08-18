import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProxyService } from "../../src/services/proxy.service.js";

describe("ProxyService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards safe headers, body, and query string to the upstream service", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, requestId: "req_proxy" }), {
        status: 202,
        headers: {
          "content-type": "application/json",
          connection: "keep-alive",
        },
      }),
    );
    const response = createMockResponse();

    await new ProxyService().forward(createMockRequest(), response, {
      baseUrl: "http://po-ingestion-service:4100",
      pathPrefix: "",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [upstreamUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(upstreamUrl)).toBe(
      "http://po-ingestion-service:4100/ingest/logs?projectId=prj_1",
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ message: "checkout failed" }));
    expect((init?.headers as Headers).get("x-api-key")).toBe("po_live_test");
    expect((init?.headers as Headers).get("x-request-id")).toBe("req_proxy");
    expect((init?.headers as Headers).get("cookie")).toBeNull();
    expect(response.statusCode).toBe(202);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.has("connection")).toBe(false);
    expect(response.body).toBe('{"data":{"ok":true},"requestId":"req_proxy"}');
  });
});

function createMockRequest(): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    cookie: "session=ignored",
    "x-api-key": "po_live_test",
    "x-request-id": "req_proxy",
  };

  return {
    method: "POST",
    originalUrl: "/ingest/logs?projectId=prj_1",
    body: { message: "checkout failed" },
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function createMockResponse(): Response & {
  readonly headers: Headers;
  body: string;
  statusCode: number;
} {
  const headers = new Headers();
  const response = {
    headers,
    body: "",
    statusCode: 200,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    setHeader(headerName: string, headerValue: string) {
      headers.set(headerName, headerValue);
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };

  return response as unknown as Response & {
    readonly headers: Headers;
    body: string;
    statusCode: number;
  };
}
