import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MonitorCondition, MonitorRule } from "@pulseops/shared";
import {
  MonitorEvaluatorService,
  type TelemetryDataProvider,
} from "../../src/services/monitor-evaluator.service.js";
import { NotificationDispatcherService } from "../../src/services/notification-dispatcher.service.js";
import type { MonitorRepository } from "../../src/repositories/monitor.repository.js";
import type { NotificationChannelRepository } from "../../src/repositories/notification-channel.repository.js";
import type { SilenceWindowRepository } from "../../src/repositories/silence-window.repository.js";

describe("Monitors and Notification Routing Engine", () => {
  let mockMonitorRepo: Partial<MonitorRepository>;
  let mockSilenceRepo: Partial<SilenceWindowRepository>;
  let mockChannelRepo: Partial<NotificationChannelRepository>;
  let mockTelemetryProvider: Partial<TelemetryDataProvider>;
  let notificationDispatcher: NotificationDispatcherService;
  let evaluatorService: MonitorEvaluatorService;

  beforeEach(() => {
    mockMonitorRepo = {
      updateEvaluationState: vi.fn().mockResolvedValue(null),
      listAllActive: vi.fn().mockResolvedValue([]),
    };

    mockSilenceRepo = {
      listActiveSilence: vi.fn().mockResolvedValue([]),
      listActiveMaintenance: vi.fn().mockResolvedValue([]),
    };

    mockChannelRepo = {
      listChannels: vi.fn().mockResolvedValue([]),
      listRoutingRules: vi.fn().mockResolvedValue([]),
      updateDispatchStatus: vi.fn().mockResolvedValue(undefined),
    };

    mockTelemetryProvider = {
      queryLogCount: vi.fn().mockResolvedValue(0),
      queryMetricValue: vi.fn().mockResolvedValue(45),
      queryErrorRate: vi.fn().mockResolvedValue({ errorRatePercent: 0.5, totalEvents: 1000 }),
      queryLatencyP95: vi.fn().mockResolvedValue(150),
      queryQueueBacklog: vi.fn().mockResolvedValue(0),
      queryWorkerStaleAge: vi.fn().mockResolvedValue(10),
      queryVaultAnomalies: vi.fn().mockResolvedValue(0),
    };

    notificationDispatcher = new NotificationDispatcherService(
      mockChannelRepo as NotificationChannelRepository,
      mockSilenceRepo as SilenceWindowRepository,
    );

    evaluatorService = new MonitorEvaluatorService(
      mockMonitorRepo as MonitorRepository,
      notificationDispatcher,
      mockTelemetryProvider as TelemetryDataProvider,
    );
  });

  describe("Monitor Condition Evaluator", () => {
    it("evaluates numeric comparators accurately", () => {
      const gtCondition: MonitorCondition = {
        comparator: ">",
        threshold: 100,
        timeWindowMinutes: 5,
      };
      expect(evaluatorService.evaluateCondition(gtCondition, 150)).toBe(true);
      expect(evaluatorService.evaluateCondition(gtCondition, 100)).toBe(false);
      expect(evaluatorService.evaluateCondition(gtCondition, 50)).toBe(false);

      const gteCondition: MonitorCondition = {
        comparator: ">=",
        threshold: 100,
        timeWindowMinutes: 5,
      };
      expect(evaluatorService.evaluateCondition(gteCondition, 100)).toBe(true);

      const lteCondition: MonitorCondition = {
        comparator: "<=",
        threshold: 50,
        timeWindowMinutes: 5,
      };
      expect(evaluatorService.evaluateCondition(lteCondition, 40)).toBe(true);
      expect(evaluatorService.evaluateCondition(lteCondition, 60)).toBe(false);
    });

    it("evaluates error_rate monitor rules and detects state changes", async () => {
      const monitor: MonitorRule = {
        id: "mon_err_1",
        projectId: "proj_123",
        name: "High API Error Rate",
        ruleType: "error_rate",
        severity: "critical",
        state: "ok",
        enabled: true,
        condition: { comparator: ">", threshold: 2.0, timeWindowMinutes: 5 },
        evaluationIntervalSeconds: 60,
        tags: ["api", "slo"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock high error rate > 2.0%
      (mockTelemetryProvider.queryErrorRate as ReturnType<typeof vi.fn>).mockResolvedValue({
        errorRatePercent: 8.5,
        totalEvents: 500,
      });

      const result = await evaluatorService.evaluateMonitor(monitor);

      expect(result.previousState).toBe("ok");
      expect(result.nextState).toBe("alert");
      expect(result.stateChanged).toBe(true);
      expect(result.observedValue).toBe(8.5);
      expect(mockMonitorRepo.updateEvaluationState).toHaveBeenCalledWith(
        "proj_123",
        "mon_err_1",
        expect.objectContaining({
          state: "alert",
          evaluatedValue: 8.5,
          stateChanged: true,
        }),
      );
    });

    it("evaluates latency_p95 monitor rules", async () => {
      const monitor: MonitorRule = {
        id: "mon_lat_1",
        projectId: "proj_123",
        name: "p95 Latency Degradation",
        ruleType: "latency_p95",
        severity: "high",
        state: "ok",
        enabled: true,
        condition: { comparator: ">", threshold: 300, timeWindowMinutes: 5 },
        evaluationIntervalSeconds: 60,
        tags: ["latency"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Latency is 180ms <= 300ms
      (mockTelemetryProvider.queryLatencyP95 as ReturnType<typeof vi.fn>).mockResolvedValue(180);

      const result = await evaluatorService.evaluateMonitor(monitor);

      expect(result.nextState).toBe("ok");
      expect(result.stateChanged).toBe(false);
    });
  });

  describe("Silence & Maintenance Window Suppression", () => {
    it("suppresses notification dispatch when active silence window matches", async () => {
      (mockSilenceRepo.listActiveSilence as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "silence_1",
          projectId: "proj_123",
          name: "Deploy Silence",
          matchers: { environment: "production" },
          startsAt: new Date(Date.now() - 3600000).toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString(),
          reason: "Scheduled deploy",
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      const res = await notificationDispatcher.dispatchAlert({
        monitorId: "mon_1",
        monitorName: "Checkout Latency",
        projectId: "proj_123",
        state: "alert",
        severity: "critical",
        ruleType: "latency_p95",
        value: 850,
        threshold: 500,
        message: "High latency observed",
        timestamp: new Date().toISOString(),
        environment: "production",
      });

      expect(res.suppressed).toBe(true);
      expect(res.dispatched).toBe(0);
      expect(res.suppressionReason).toContain("Suppressed by silence window");
    });
  });
});
