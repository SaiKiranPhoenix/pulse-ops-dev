import type { Request, Response } from "express";
import { dependencyUnavailable } from "@pulseops/shared";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const forwardedRequestHeaders = new Set([
  "authorization",
  "content-type",
  "idempotency-key",
  "x-api-key",
  "x-request-id",
]);

export type ProxyTarget = {
  readonly baseUrl: string;
  readonly pathPrefix: string;
};

export class ProxyService {
  async forward(request: Request, response: Response, target: ProxyTarget): Promise<void> {
    const upstreamUrl = createUpstreamUrl(target.baseUrl, target.pathPrefix, request);
    const upstreamResponse = await fetchUpstream(request, upstreamUrl);
    const responseBody = await readUpstreamBody(upstreamResponse);

    response.status(upstreamResponse.status);
    forwardResponseHeaders(upstreamResponse, response);

    if (responseBody.length === 0) {
      response.end();
      return;
    }

    response.send(responseBody);
  }
}

async function fetchUpstream(request: Request, upstreamUrl: URL): Promise<globalThis.Response> {
  try {
    const requestInit: RequestInit = {
      method: request.method,
      headers: buildForwardHeaders(request),
      ...(hasBody(request.method) ? { body: JSON.stringify(request.body ?? {}) } : {}),
    };

    return await fetch(upstreamUrl, requestInit);
  } catch (error) {
    throw dependencyUnavailable("Upstream service unavailable", {
      cause: error instanceof Error ? error.message : "unknown",
    });
  }
}

function createUpstreamUrl(baseUrl: string, pathPrefix: string, request: Request): URL {
  return new URL(`${pathPrefix}${request.originalUrl}`, ensureTrailingSlash(baseUrl));
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function hasBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const [headerName, headerValue] of Object.entries(request.headers)) {
    const normalizedName = headerName.toLowerCase();

    if (!forwardedRequestHeaders.has(normalizedName) || headerValue === undefined) {
      continue;
    }

    if (Array.isArray(headerValue)) {
      headers.set(normalizedName, headerValue.join(","));
      continue;
    }

    headers.set(normalizedName, headerValue);
  }

  if (hasBody(request.method) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function readUpstreamBody(upstreamResponse: globalThis.Response): Promise<string> {
  try {
    return await upstreamResponse.text();
  } catch (error) {
    throw dependencyUnavailable("Upstream response could not be read", {
      cause: error instanceof Error ? error.message : "unknown",
    });
  }
}

function forwardResponseHeaders(upstreamResponse: globalThis.Response, response: Response): void {
  upstreamResponse.headers.forEach((headerValue, headerName) => {
    if (!hopByHopHeaders.has(headerName.toLowerCase())) {
      response.setHeader(headerName, headerValue);
    }
  });
}
