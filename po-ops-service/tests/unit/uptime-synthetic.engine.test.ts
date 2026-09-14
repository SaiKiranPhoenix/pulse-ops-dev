import { describe, expect, it } from "vitest";
import { UptimeRumRepository } from "../../src/repositories/uptime-rum.repository.js";
import { UptimeSyntheticEngine } from "../../src/services/uptime-synthetic.engine.js";

describe("UptimeSyntheticEngine", () => {
  describe("Synthetic Assertion Evaluation", () => {
    it("evaluates status_code assertions correctly", () => {
      const pass = UptimeSyntheticEngine.evaluateAssertion(
        { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
        { statusCode: 200, responseTimeMs: 45 },
      );
      expect(pass.passed).toBe(true);

      const fail = UptimeSyntheticEngine.evaluateAssertion(
        { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
        { statusCode: 500, responseTimeMs: 45 },
      );
      expect(fail.passed).toBe(false);
    });

    it("evaluates response_time SLA threshold assertions", () => {
      const pass = UptimeSyntheticEngine.evaluateAssertion(
        { type: "response_time", target: "latency", operator: "less_than", expectedValue: 300 },
        { statusCode: 200, responseTimeMs: 120 },
      );
      expect(pass.passed).toBe(true);

      const fail = UptimeSyntheticEngine.evaluateAssertion(
        { type: "response_time", target: "latency", operator: "less_than", expectedValue: 100 },
        { statusCode: 200, responseTimeMs: 250 },
      );
      expect(fail.passed).toBe(false);
    });

    it("evaluates body_contains assertions", () => {
      const pass = UptimeSyntheticEngine.evaluateAssertion(
        { type: "body_contains", target: "body", operator: "contains", expectedValue: "pong" },
        { statusCode: 200, responseTimeMs: 20, body: '{"message": "pong"}' },
      );
      expect(pass.passed).toBe(true);

      const fail = UptimeSyntheticEngine.evaluateAssertion(
        { type: "body_contains", target: "body", operator: "contains", expectedValue: "pong" },
        { statusCode: 200, responseTimeMs: 20, body: '{"error": "bad request"}' },
      );
      expect(fail.passed).toBe(false);
    });
  });

  describe("UptimeRumRepository", () => {
    const repo = new UptimeRumRepository();

    it("lists default seeded synthetic probes", async () => {
      const checks = await repo.listChecks("default");
      expect(checks.length).toBeGreaterThanOrEqual(3);
      expect(checks.some((c) => c.name.includes("Gateway"))).toBe(true);
    });

    it("executes synthetic probe on-demand and updates history", async () => {
      const checks = await repo.listChecks("default");
      const target = checks[0]!;

      const result = await repo.executeAndRecordCheck("default", target.id);
      expect(result).not.toBeNull();
      expect(result?.checkId).toBe(target.id);
      expect(result?.responseTimeMs).toBeGreaterThan(0);
      expect(result?.status).toBe("up");

      const history = await repo.getCheckHistory("default", target.id);
      expect(history.length).toBeGreaterThan(0);
    });

    it("creates, updates, and deletes synthetic monitors", async () => {
      const created = await repo.createCheck("default", {
        name: "Test Checkout API Probe",
        url: "https://example.com/checkout/health",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 3000,
        expectedStatusCode: 200,
      });
      expect(created.id).toBeDefined();

      const updated = await repo.updateCheck("default", created.id, {
        name: "Renamed Checkout API Probe",
      });
      expect(updated?.name).toBe("Renamed Checkout API Probe");

      const deleted = await repo.deleteCheck("default", created.id);
      expect(deleted).toBe(true);
    });

    it("records and retrieves RUM Web Vitals overview", async () => {
      await repo.recordRumEvent("default", {
        sessionId: "sess_123",
        pageUrl: "https://app.pulseops.dev/dashboard",
        lcpMs: 1200,
        fidMs: 18,
        cls: 0.02,
        device: "desktop",
        browser: "Chrome",
        os: "Windows",
      });

      const overview = await repo.getRumOverview("default");
      expect(overview.totalPageViews).toBeGreaterThan(0);
      expect(overview.avgLcpMs).toBeGreaterThan(0);
      expect(overview.browserBreakdown.length).toBeGreaterThan(0);
    });
  });
});
