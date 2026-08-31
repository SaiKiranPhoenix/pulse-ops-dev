import type {
  CreateUptimeCheckInput,
  RumEvent,
  RumOverview,
  UpdateUptimeCheckInput,
  UptimeCheck,
  UptimeCheckResult,
} from "@pulseops/shared";
import { UptimeSyntheticEngine } from "../services/uptime-synthetic.engine.js";

export class UptimeRumRepository {
  private readonly checksStore = new Map<string, UptimeCheck>();
  private readonly resultsHistory = new Map<string, UptimeCheckResult[]>();
  private readonly rumEventsStore: RumEvent[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();

    const defaultChecks: UptimeCheck[] = [
      {
        id: "chk_gateway",
        projectId: "default",
        name: "PulseOps API Gateway Healthcheck",
        url: "http://localhost:4000/health",
        method: "GET",
        intervalSeconds: 30,
        timeoutMs: 3000,
        expectedStatusCode: 200,
        syntheticAssertions: [
          { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
          { type: "response_time", target: "latency", operator: "less_than", expectedValue: 250 },
        ],
        status: "up",
        uptimePercent24h: 99.98,
        avgResponseTimeMs: 18.4,
        consecutiveFailures: 0,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "chk_ingest",
        projectId: "default",
        name: "Ingestion Pipeline Synthetic Ping",
        url: "http://localhost:4001/health",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCode: 200,
        syntheticAssertions: [
          { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
          { type: "response_time", target: "latency", operator: "less_than", expectedValue: 500 },
          { type: "body_contains", target: "body", operator: "contains", expectedValue: "ok" },
        ],
        status: "up",
        uptimePercent24h: 99.94,
        avgResponseTimeMs: 24.1,
        consecutiveFailures: 0,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "chk_auth_login",
        projectId: "default",
        name: "Auth Service Synthetic Probe",
        url: "http://localhost:4002/health",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 4000,
        expectedStatusCode: 200,
        syntheticAssertions: [
          { type: "status_code", target: "status", operator: "equals", expectedValue: 200 },
          { type: "response_time", target: "latency", operator: "less_than", expectedValue: 400 },
        ],
        status: "up",
        uptimePercent24h: 100.0,
        avgResponseTimeMs: 15.2,
        consecutiveFailures: 0,
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const chk of defaultChecks) {
      this.checksStore.set(chk.id, chk);

      // Seed 20 historical check points
      const history: UptimeCheckResult[] = [];
      const baseTime = Date.now();
      for (let i = 20; i >= 0; i--) {
        const time = new Date(baseTime - i * 60 * 1000).toISOString();
        history.push({
          id: `res_${chk.id}_${i}`,
          checkId: chk.id,
          timestamp: time,
          status: "up",
          statusCode: 200,
          responseTimeMs: Number((chk.avgResponseTimeMs + (Math.random() * 10 - 5)).toFixed(1)),
          assertionResults: [
            { name: "status_code: status equals 200", passed: true },
            { name: "response_time: latency less_than timeout", passed: true },
          ],
        });
      }
      this.resultsHistory.set(chk.id, history);
    }
  }

  // Uptime Check CRUD
  async listChecks(projectId: string): Promise<UptimeCheck[]> {
    const list = Array.from(this.checksStore.values()).filter(
      (c) => c.projectId === projectId || c.projectId === "default",
    );
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findCheckById(projectId: string, id: string): Promise<UptimeCheck | null> {
    const found = this.checksStore.get(id);
    if (!found || (found.projectId !== projectId && found.projectId !== "default")) return null;
    return found;
  }

  async createCheck(projectId: string, input: CreateUptimeCheckInput): Promise<UptimeCheck> {
    const id = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const check: UptimeCheck = {
      id,
      projectId,
      name: input.name,
      url: input.url,
      method: input.method ?? "GET",
      headers: input.headers,
      body: input.body,
      intervalSeconds: input.intervalSeconds ?? 60,
      timeoutMs: input.timeoutMs ?? 5000,
      expectedStatusCode: input.expectedStatusCode ?? 200,
      syntheticAssertions: input.syntheticAssertions ?? [],
      status: "up",
      uptimePercent24h: 100.0,
      avgResponseTimeMs: 25.0,
      consecutiveFailures: 0,
      lastCheckedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.checksStore.set(id, check);
    return check;
  }

  async updateCheck(
    projectId: string,
    id: string,
    input: UpdateUptimeCheckInput,
  ): Promise<UptimeCheck | null> {
    const existing = await this.findCheckById(projectId, id);
    if (!existing) return null;

    const updated: UptimeCheck = {
      ...existing,
      name: input.name ?? existing.name,
      url: input.url ?? existing.url,
      method: input.method ?? existing.method,
      headers: input.headers !== undefined ? input.headers : existing.headers,
      body: input.body !== undefined ? input.body : existing.body,
      intervalSeconds: input.intervalSeconds ?? existing.intervalSeconds,
      timeoutMs: input.timeoutMs ?? existing.timeoutMs,
      expectedStatusCode: input.expectedStatusCode ?? existing.expectedStatusCode,
      syntheticAssertions: input.syntheticAssertions ?? existing.syntheticAssertions,
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    this.checksStore.set(id, updated);
    return updated;
  }

  async deleteCheck(projectId: string, id: string): Promise<boolean> {
    const existing = await this.findCheckById(projectId, id);
    if (!existing) return false;
    this.resultsHistory.delete(id);
    return this.checksStore.delete(id);
  }

  // Execute Check and store result
  async executeAndRecordCheck(projectId: string, id: string): Promise<UptimeCheckResult | null> {
    const check = await this.findCheckById(projectId, id);
    if (!check) return null;

    const result = await UptimeSyntheticEngine.executeSyntheticCheck(check);

    const history = this.resultsHistory.get(id) || [];
    history.push(result);
    if (history.length > 100) history.shift();
    this.resultsHistory.set(id, history);

    // Update check status and stats
    const updatedCheck: UptimeCheck = {
      ...check,
      status: result.status,
      lastCheckedAt: result.timestamp,
      avgResponseTimeMs: Number(
        (
          history.reduce((sum, r) => sum + r.responseTimeMs, 0) /
          history.length
        ).toFixed(1),
      ),
      uptimePercent24h: Number(
        (
          (history.filter((r) => r.status === "up").length / history.length) *
          100
        ).toFixed(2),
      ),
      consecutiveFailures: result.status === "down" ? check.consecutiveFailures + 1 : 0,
      updatedAt: new Date().toISOString(),
    };
    this.checksStore.set(id, updatedCheck);

    return result;
  }

  async getCheckHistory(projectId: string, id: string): Promise<UptimeCheckResult[]> {
    const check = await this.findCheckById(projectId, id);
    if (!check) return [];
    return this.resultsHistory.get(id) || [];
  }

  // RUM Operations
  async recordRumEvent(projectId: string, event: Omit<RumEvent, "id" | "projectId" | "timestamp">): Promise<RumEvent> {
    const recorded: RumEvent = {
      ...event,
      id: `rum_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      timestamp: new Date().toISOString(),
    };
    this.rumEventsStore.push(recorded);
    return recorded;
  }

  async getRumOverview(projectId: string): Promise<RumOverview> {
    return {
      totalPageViews: 14820,
      avgLcpMs: 1420,
      avgFidMs: 24,
      avgCls: 0.04,
      avgTtfbMs: 180,
      lcpGrade: "good",
      fidGrade: "good",
      clsGrade: "good",
      browserBreakdown: [
        { browser: "Chrome", count: 9820, percentage: 66.2 },
        { browser: "Safari", count: 3150, percentage: 21.3 },
        { browser: "Firefox", count: 1240, percentage: 8.4 },
        { browser: "Edge", count: 610, percentage: 4.1 },
      ],
      deviceBreakdown: [
        { device: "desktop", count: 10420, percentage: 70.3 },
        { device: "mobile", count: 3850, percentage: 26.0 },
        { device: "tablet", count: 550, percentage: 3.7 },
      ],
    };
  }
}
