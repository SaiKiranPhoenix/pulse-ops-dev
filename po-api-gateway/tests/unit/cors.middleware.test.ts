import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createCorsMiddleware } from "../../src/middlewares/cors.middleware.js";

describe("createCorsMiddleware", () => {
  it("allows configured UI origins and continues non-preflight requests", () => {
    const middleware = createCorsMiddleware("http://localhost:3000,http://127.0.0.1:3000");
    const response = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(createMockRequest("GET", "http://localhost:3000"), response, next);

    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(next).toHaveBeenCalledOnce();
  });

  it("responds to allowed preflight requests without continuing", () => {
    const middleware = createCorsMiddleware("http://localhost:3000");
    const response = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(createMockRequest("OPTIONS", "http://localhost:3000"), response, next);

    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects unknown preflight origins", () => {
    const middleware = createCorsMiddleware("http://localhost:3000");
    const response = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(createMockRequest("OPTIONS", "https://evil.example"), response, next);

    expect(response.statusCode).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(response.ended).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});

function createMockRequest(method: string, origin: string): Request {
  return {
    method,
    header: (name: string) => (name.toLowerCase() === "origin" ? origin : undefined),
  } as Request;
}

function createMockResponse(): Response & {
  ended: boolean;
  readonly headers: Headers;
  statusCode: number;
} {
  const headers = new Headers();
  const response = {
    ended: false,
    headers,
    statusCode: 200,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    setHeader(headerName: string, headerValue: string) {
      headers.set(headerName, headerValue);
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };

  return response as Response & {
    ended: boolean;
    readonly headers: Headers;
    statusCode: number;
  };
}
