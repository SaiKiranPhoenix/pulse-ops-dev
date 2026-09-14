import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SloDocumentData } from "@pulseops/shared";
import {
  SloEvaluatorService,
  type SliMetricsProvider,
} from "../../src/services/slo-evaluator.service.js";
import type { SloRepository } from "../../src/repositories/slo.repository.js";
import type { IncidentService } from "../../src/services/incident.service.js";

describe("SLO Evaluator & Error Budget Engine", () => {
  let mockSloRepo: Partial<SloRepository>;
  let mockIncidentService: Partial<IncidentService>;
  let mockMetricsProvider: Partial<SliMetricsProvider>;
  let evaluatorService: SloEvaluatorService;

  beforeEach(() => {
    mockSloRepo = {
      updateCalculation: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
    };

    mockIncidentService = {
      evaluateError: vi.fn().mockResolvedValue({
        incident: { id: "inc_1", title: "Test Incident" },
        created: true,
      }),
    };

    mockMetricsProvider = {
      fetchSliTelemetry: vi.fn().mockResolvedValue({
        goodEvents: 99950,
        totalEvents: 100000,
        badEvents: 50,
      }),
    };

    evaluatorService = new SloEvaluatorService(
      mockSloRepo as SloRepository,
      mockIncidentService as IncidentService,
      mockMetricsProvider as SliMetricsProvider,
    );
  });

  describe("calculateSlo math", () => {
    it("correctly calculates remaining error budget for healthy SLI", () => {
      // 99.9% target, allowed error = 0.1%
      // 99,950 / 100,000 = 99.95% SLI, actual error = 0.05%
      // consumed = 0.05 / 0.1 = 50%, remaining = 50%
      const res = evaluatorService.calculateSlo(99.9, 99950, 100000, 30);

      expect(res.currentSliPercent).toBe(99.95);
      expect(res.errorBudgetTotalPercent).toBe(0.1);
      expect(res.errorBudgetConsumedPercent).toBe(50);
      expect(res.errorBudgetRemainingPercent).toBe(50);
      expect(res.status).toBe("compliant");
      expect(res.burnRate1h).toBe(0.5);
    });

    it("detects at_risk state when error budget is below 20%", () => {
      // 99.9% target, actual error = 0.085% -> 85% consumed, 15% remaining
      const res = evaluatorService.calculateSlo(99.9, 99915, 100000, 30);

      expect(res.currentSliPercent).toBe(99.915);
      expect(res.errorBudgetConsumedPercent).toBe(85);
      expect(res.errorBudgetRemainingPercent).toBe(15);
      expect(res.status).toBe("at_risk");
    });

    it("detects breached state when SLI drops below target", () => {
      // 99.9% target, SLI = 99.80% (actual error = 0.20% > 0.10%)
      const res = evaluatorService.calculateSlo(99.9, 99800, 100000, 30);

      expect(res.currentSliPercent).toBe(99.8);
      expect(res.errorBudgetRemainingPercent).toBe(0);
      expect(res.status).toBe("breached");
    });
  });

  describe("evaluateSlo & automated breach incidents", () => {
    it("evaluates SLO and triggers incident on breach", async () => {
      const slo: SloDocumentData = {
        id: "slo_api_1",
        projectId: "proj_abc",
        name: "Gateway 99.99% Availability",
        sli: { type: "availability", serviceName: "po-api-gateway", environment: "production" },
        target: { targetPercent: 99.99, rollingWindowDays: 30 },
        tags: ["core"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock degraded telemetry: 99.5% SLI < 99.99% Target
      (mockMetricsProvider.fetchSliTelemetry as ReturnType<typeof vi.fn>).mockResolvedValue({
        goodEvents: 99500,
        totalEvents: 100000,
        badEvents: 500,
      });

      const res = await evaluatorService.evaluateSlo(slo);

      expect(res.calculation.status).toBe("breached");
      expect(res.incidentTriggered).toBe(true);
      expect(mockIncidentService.evaluateError).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "proj_abc",
          message: expect.stringContaining("SLO Breach: Gateway 99.99% Availability"),
        }),
      );
    });
  });

  describe("generateReport", () => {
    it("aggregates reliability score across multiple SLOs", async () => {
      (mockSloRepo.list as ReturnType<typeof vi.fn>).mockResolvedValue([
        { calculation: { status: "compliant", errorBudgetRemainingPercent: 80 } },
        { calculation: { status: "compliant", errorBudgetRemainingPercent: 90 } },
        { calculation: { status: "at_risk", errorBudgetRemainingPercent: 15 } },
        { calculation: { status: "breached", errorBudgetRemainingPercent: 0 } },
      ]);

      const report = await evaluatorService.generateReport("proj_abc");

      expect(report.totalSlos).toBe(4);
      expect(report.compliantCount).toBe(2);
      expect(report.atRiskCount).toBe(1);
      expect(report.breachedCount).toBe(1);
      // (80 + 90 + 15 + 0) / 4 = 46.25%
      expect(report.averageRemainingBudgetPercent).toBe(46.25);
    });
  });
});
