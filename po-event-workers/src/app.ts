import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type EventWorkerHealthStatus = "starting" | "ok" | "stopping";

export type EventWorkerHealthResponse = {
  readonly status: EventWorkerHealthStatus;
  readonly service: string;
  readonly workerId: string;
  readonly startedAt: string;
  readonly uptimeSeconds: number;
  readonly metrics: {
    readonly processed: number;
    readonly processedByType: {
      readonly log: number;
      readonly error: number;
      readonly metric: number;
    };
    readonly failed: number;
    readonly retries: number;
    readonly poisonMessages: number;
    readonly lastProcessedAt: string | null;
    readonly lastErrorAt: string | null;
    readonly lastErrorMessage: string | null;
  };
};

export function createHealthServer(getHealth: () => EventWorkerHealthResponse): Server {
  return createServer((request, response) => {
    if (request.method === "GET" && getPathname(request) === "/health") {
      sendJson(response, 200, getHealth());
      return;
    }

    sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}

function getPathname(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://127.0.0.1").pathname;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
