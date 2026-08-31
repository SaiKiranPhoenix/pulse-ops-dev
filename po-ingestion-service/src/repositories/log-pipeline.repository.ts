import type {
  CreateLogPipelineRuleInput,
  CreateSavedLogSearchInput,
  LogContextResponse,
  LogPipelineRule,
  LogRetentionSettings,
  LogVolumeAnalytics,
  SavedLogSearch,
  UpdateLogPipelineRuleInput,
  UpdateLogRetentionSettingsInput,
} from "@pulseops/shared";

export class LogPipelineRepository {
  private readonly rulesStore = new Map<string, LogPipelineRule>();
  private readonly retentionStore = new Map<string, LogRetentionSettings>();
  private readonly savedSearchesStore = new Map<string, SavedLogSearch>();

  // Pipeline Rules
  async listRules(projectId: string): Promise<LogPipelineRule[]> {
    const list = Array.from(this.rulesStore.values()).filter((r) => r.projectId === projectId);
    return list.sort((a, b) => a.order - b.order);
  }

  async findRuleById(projectId: string, ruleId: string): Promise<LogPipelineRule | null> {
    const rule = this.rulesStore.get(ruleId);
    if (!rule || rule.projectId !== projectId) return null;
    return rule;
  }

  async createRule(projectId: string, input: CreateLogPipelineRuleInput): Promise<LogPipelineRule> {
    const id = `lpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rule: LogPipelineRule = {
      id,
      projectId,
      name: input.name,
      description: input.description,
      order: input.order ?? 0,
      enabled: input.enabled ?? true,
      processors: input.processors ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rulesStore.set(id, rule);
    return rule;
  }

  async updateRule(
    projectId: string,
    ruleId: string,
    input: UpdateLogPipelineRuleInput,
  ): Promise<LogPipelineRule | null> {
    const existing = await this.findRuleById(projectId, ruleId);
    if (!existing) return null;

    const updated: LogPipelineRule = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      order: input.order ?? existing.order,
      enabled: input.enabled ?? existing.enabled,
      processors: input.processors ?? existing.processors,
      updatedAt: new Date().toISOString(),
    };
    this.rulesStore.set(ruleId, updated);
    return updated;
  }

  async deleteRule(projectId: string, ruleId: string): Promise<boolean> {
    const existing = await this.findRuleById(projectId, ruleId);
    if (!existing) return false;
    return this.rulesStore.delete(ruleId);
  }

  // Retention Settings
  async getRetention(projectId: string): Promise<LogRetentionSettings> {
    const existing = this.retentionStore.get(projectId);
    if (existing) return existing;

    const defaultSettings: LogRetentionSettings = {
      projectId,
      retentionDays: 30,
      coldArchiveEnabled: false,
      updatedAt: new Date().toISOString(),
    };
    this.retentionStore.set(projectId, defaultSettings);
    return defaultSettings;
  }

  async updateRetention(
    projectId: string,
    input: UpdateLogRetentionSettingsInput,
  ): Promise<LogRetentionSettings> {
    const existing = await this.getRetention(projectId);
    const updated: LogRetentionSettings = {
      ...existing,
      retentionDays: input.retentionDays,
      coldArchiveEnabled: input.coldArchiveEnabled ?? existing.coldArchiveEnabled,
      coldArchiveBucket: input.coldArchiveBucket !== undefined ? input.coldArchiveBucket : existing.coldArchiveBucket,
      updatedAt: new Date().toISOString(),
    };
    this.retentionStore.set(projectId, updated);
    return updated;
  }

  // Saved Searches
  async listSavedSearches(projectId: string): Promise<SavedLogSearch[]> {
    const list = Array.from(this.savedSearchesStore.values()).filter((s) => s.projectId === projectId);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSavedSearch(projectId: string, input: CreateSavedLogSearchInput): Promise<SavedLogSearch> {
    const id = `lss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved: SavedLogSearch = {
      id,
      projectId,
      name: input.name,
      query: input.query,
      serviceFilter: input.serviceFilter,
      levelFilter: input.levelFilter,
      environment: input.environment,
      timeframe: input.timeframe ?? "15m",
      createdAt: new Date().toISOString(),
    };
    this.savedSearchesStore.set(id, saved);
    return saved;
  }

  async deleteSavedSearch(projectId: string, searchId: string): Promise<boolean> {
    const item = this.savedSearchesStore.get(searchId);
    if (!item || item.projectId !== projectId) return false;
    return this.savedSearchesStore.delete(searchId);
  }

  // Log Context Window Retrieval (+- 25 surrounding events)
  async getLogContext(projectId: string, eventId: string): Promise<LogContextResponse> {
    const baseTime = Date.now();
    const services = ["po-api-gateway", "po-event-workers", "po-auth-project-service", "po-vault-service"];

    const before: Array<Record<string, unknown>> = [];
    for (let i = 25; i >= 1; i--) {
      const ts = new Date(baseTime - i * 1500).toISOString();
      const srv = services[i % services.length]!;
      before.push({
        id: `evt_ctx_before_${i}`,
        projectId,
        service: srv,
        level: i % 7 === 0 ? "warn" : "info",
        message: `Surrounding precursor log line #${i} from ${srv} - transaction chunk processed`,
        timestamp: ts,
        traceId: `trc_${projectId}_${i}`,
      });
    }

    const target: Record<string, unknown> = {
      id: eventId,
      projectId,
      service: "po-api-gateway",
      level: "error",
      message: `Target investigation event [${eventId}]: Downstream connection pool exhausted during burst ingestion`,
      timestamp: new Date(baseTime).toISOString(),
      traceId: `trc_${projectId}_target`,
      stack: "Error: Connection pool exhausted\n    at Pool.acquire (db.ts:42)\n    at RequestHandler (server.ts:18)",
    };

    const after: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 25; i++) {
      const ts = new Date(baseTime + i * 1500).toISOString();
      const srv = services[i % services.length]!;
      after.push({
        id: `evt_ctx_after_${i}`,
        projectId,
        service: srv,
        level: i % 4 === 0 ? "warn" : "info",
        message: `Post-incident recovery log line #${i} from ${srv} - circuit breaker half-open retry`,
        timestamp: ts,
        traceId: `trc_${projectId}_${i + 50}`,
      });
    }

    return {
      targetEventId: eventId,
      before,
      target,
      after,
    };
  }

  // Volume & Rate Analytics
  async getVolumeAnalytics(projectId: string): Promise<LogVolumeAnalytics> {
    return {
      projectId,
      totalEventsPerSec: Math.floor(450 + Math.random() * 80),
      totalBytesPerSec: Math.floor(128000 + Math.random() * 25000),
      byService: {
        "po-api-gateway": 185,
        "po-event-workers": 140,
        "po-auth-project-service": 65,
        "po-vault-service": 42,
        "po-incident-service": 18,
      },
      byLevel: {
        info: 380,
        warn: 45,
        error: 20,
        debug: 5,
      },
      sampledPercentage: 12.5,
      redactedCount: 34,
      timestamp: new Date().toISOString(),
    };
  }
}
