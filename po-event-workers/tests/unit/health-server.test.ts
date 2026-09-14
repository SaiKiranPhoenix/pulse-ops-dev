import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createHealthServer } from "../../src/app.js";

describe("event worker health server", () => {
  it("serves worker readiness and processing stats from /health", async () => {
    const server = createHealthServer(() => ({
      status: "ok",
      service: "po-event-workers",
      workerId: "worker_1",
      startedAt: "2026-08-28T00:00:00.000Z",
      uptimeSeconds: 12,
      metrics: {
        processed: 3,
        processedByType: {
          log: 1,
          error: 1,
          metric: 1,
        },
        failed: 0,
        retries: 0,
        poisonMessages: 0,
        lastProcessedAt: "2026-08-28T00:00:10.000Z",
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    }));

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);

      await expect(response.json()).resolves.toMatchObject({
        status: "ok",
        service: "po-event-workers",
        workerId: "worker_1",
        metrics: {
          processed: 3,
        },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
