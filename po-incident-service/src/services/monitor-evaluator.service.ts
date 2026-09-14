import type {
  AlertNotificationPayload,
  MonitorCondition,
  MonitorRule,
  MonitorState,
} from "@pulseops/shared";
import type { MonitorRepository } from "../repositories/monitor.repository.js";
import type { NotificationDispatcherService } from "./notification-dispatcher.service.js";

export interface TelemetryDataProvider {
  queryLogCount(params: {
    projectId: string;
    logPattern?: string | undefined;
    serviceName?: string | undefined;
    environment?: string | undefined;
    since: Date;
  }): Promise<number>;

  queryMetricValue(params: {
    projectId: string;
    metricName: string;
    serviceName?: string | undefined;
    environment?: string | undefined;
    since: Date;
  }): Promise<number | null>;

  queryErrorRate(params: {
    projectId: string;
    serviceName?: string | undefined;
    environment?: string | undefined;
    since: Date;
  }): Promise<{ errorRatePercent: number; totalEvents: number }>;

  queryLatencyP95(params: {
    projectId: string;
    serviceName?: string | undefined;
    environment?: string | undefined;
    since: Date;
  }): Promise<number | null>;

  queryQueueBacklog(params: { projectId: string; since: Date }): Promise<number>;

  queryWorkerStaleAge(params: { projectId: string; since: Date }): Promise<number>;

  queryVaultAnomalies(params: { projectId: string; since: Date }): Promise<number>;
}

export class DefaultTelemetryDataProvider implements TelemetryDataProvider {
  async queryLogCount(): Promise<number> {
    return 0;
  }
  async queryMetricValue(): Promise<number | null> {
    return 45;
  }
  async queryErrorRate(): Promise<{ errorRatePercent: number; totalEvents: number }> {
    return { errorRatePercent: 0, totalEvents: 100 };
  }
  async queryLatencyP95(): Promise<number | null> {
    return 120;
  }
  async queryQueueBacklog(): Promise<number> {
    return 0;
  }
  async queryWorkerStaleAge(): Promise<number> {
    return 5;
  }
  async queryVaultAnomalies(): Promise<number> {
    return 0;
  }
}

export class MonitorEvaluatorService {
  constructor(
    private readonly monitorRepo: MonitorRepository,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly telemetryProvider: TelemetryDataProvider = new DefaultTelemetryDataProvider(),
  ) {}

  evaluateCondition(condition: MonitorCondition, observedValue: number | null): boolean {
    if (observedValue === null || Number.isNaN(observedValue)) {
      return false;
    }

    const { comparator, threshold } = condition;
    switch (comparator) {
      case ">":
        return observedValue > threshold;
      case ">=":
        return observedValue >= threshold;
      case "<":
        return observedValue < threshold;
      case "<=":
        return observedValue <= threshold;
      case "==":
        return observedValue === threshold;
      case "!=":
        return observedValue !== threshold;
      default:
        return false;
    }
  }

  async evaluateMonitor(monitor: MonitorRule): Promise<{
    monitorId: string;
    previousState: MonitorState;
    nextState: MonitorState;
    observedValue: number | null;
    message: string;
    stateChanged: boolean;
  }> {
    const windowMs = (monitor.condition.timeWindowMinutes || 5) * 60 * 1000;
    const since = new Date(Date.now() - windowMs);

    let observedValue: number | null = null;
    let message = "";

    switch (monitor.ruleType) {
      case "log_match": {
        const count = await this.telemetryProvider.queryLogCount({
          projectId: monitor.projectId,
          logPattern: monitor.condition.logPattern,
          serviceName: monitor.condition.serviceName,
          environment: monitor.condition.environment,
          since,
        });
        observedValue = count;
        message = `Found ${count} matching log entries in last ${monitor.condition.timeWindowMinutes}m`;
        break;
      }

      case "metric_threshold": {
        const metricName = monitor.condition.metricName || "custom_metric";
        observedValue = await this.telemetryProvider.queryMetricValue({
          projectId: monitor.projectId,
          metricName,
          serviceName: monitor.condition.serviceName,
          environment: monitor.condition.environment,
          since,
        });
        message = `Observed ${metricName} value: ${observedValue ?? "No Data"} (threshold ${monitor.condition.comparator} ${monitor.condition.threshold})`;
        break;
      }

      case "error_rate": {
        const rateResult = await this.telemetryProvider.queryErrorRate({
          projectId: monitor.projectId,
          serviceName: monitor.condition.serviceName,
          environment: monitor.condition.environment,
          since,
        });
        observedValue = rateResult.errorRatePercent;
        message = `Error rate is ${rateResult.errorRatePercent.toFixed(2)}% over ${rateResult.totalEvents} events`;
        break;
      }

      case "latency_p95": {
        observedValue = await this.telemetryProvider.queryLatencyP95({
          projectId: monitor.projectId,
          serviceName: monitor.condition.serviceName,
          environment: monitor.condition.environment,
          since,
        });
        message = `p95 Latency is ${observedValue ?? "N/A"}ms in last ${monitor.condition.timeWindowMinutes}m`;
        break;
      }

      case "queue_backlog": {
        observedValue = await this.telemetryProvider.queryQueueBacklog({
          projectId: monitor.projectId,
          since,
        });
        message = `Queue backlog count is ${observedValue} messages`;
        break;
      }

      case "worker_stale": {
        observedValue = await this.telemetryProvider.queryWorkerStaleAge({
          projectId: monitor.projectId,
          since,
        });
        message = `Worker heartbeat age is ${observedValue}s`;
        break;
      }

      case "vault_anomaly": {
        observedValue = await this.telemetryProvider.queryVaultAnomalies({
          projectId: monitor.projectId,
          since,
        });
        message = `Detected ${observedValue} vault audit security anomalies`;
        break;
      }
    }

    let nextState: MonitorState = "ok";

    if (observedValue === null) {
      nextState = "no_data";
    } else {
      const isTriggered = this.evaluateCondition(monitor.condition, observedValue);
      if (isTriggered) {
        nextState =
          monitor.severity === "low" || monitor.severity === "medium" ? "warning" : "alert";
      } else {
        nextState = "ok";
      }
    }

    const stateChanged = monitor.state !== nextState;

    await this.monitorRepo.updateEvaluationState(monitor.projectId, monitor.id, {
      state: nextState,
      evaluatedValue: observedValue,
      evaluationMessage: message,
      stateChanged,
    });

    if (stateChanged && (nextState === "alert" || nextState === "warning" || nextState === "ok")) {
      const alertPayload: AlertNotificationPayload = {
        monitorId: monitor.id,
        monitorName: monitor.name,
        projectId: monitor.projectId,
        state: nextState,
        severity: monitor.severity,
        ruleType: monitor.ruleType,
        value: observedValue,
        threshold: monitor.condition.threshold,
        message,
        timestamp: new Date().toISOString(),
        environment: monitor.condition.environment,
        serviceName: monitor.condition.serviceName,
      };

      void this.notificationDispatcher.dispatchAlert(alertPayload).catch(() => {});
    }

    return {
      monitorId: monitor.id,
      previousState: monitor.state,
      nextState,
      observedValue,
      message,
      stateChanged,
    };
  }

  async evaluateAllActive(): Promise<{
    totalEvaluated: number;
    stateChanges: number;
  }> {
    const monitors = await this.monitorRepo.listAllActive();
    let stateChanges = 0;

    for (const monitor of monitors) {
      try {
        const result = await this.evaluateMonitor(monitor);
        if (result.stateChanged) {
          stateChanges++;
        }
      } catch {
        // Continue evaluating remaining monitors
      }
    }

    return {
      totalEvaluated: monitors.length,
      stateChanges,
    };
  }
}
