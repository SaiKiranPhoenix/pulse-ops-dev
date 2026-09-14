import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../src/logger/index.js";

describe("createLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured logs with sensitive metadata redacted", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger({ service: "test-service", correlationId: "corr_test" });

    logger.info("request accepted", {
      projectId: "project_123",
      token: "demo",
    });

    expect(logSpy).toHaveBeenCalledOnce();

    const entry = JSON.parse(String(logSpy.mock.calls[0]?.[0]));

    expect(entry).toMatchObject({
      level: "info",
      service: "test-service",
      correlationId: "corr_test",
      message: "request accepted",
      metadata: {
        projectId: "project_123",
        token: "[REDACTED]",
      },
    });
  });
});
