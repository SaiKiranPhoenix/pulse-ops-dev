import type {
  MonitorCondition,
  MonitorRule,
  MonitorRuleType,
  MonitorSeverity,
  MonitorState,
} from "@pulseops/shared";
import { MonitorModel, type MonitorDocument } from "../models/monitor.model.js";

export class MonitorRepository {
  private mapDocument(doc: MonitorDocument): MonitorRule {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      description: doc.description,
      ruleType: doc.ruleType,
      severity: doc.severity,
      state: doc.state,
      enabled: doc.enabled,
      condition: doc.condition,
      evaluationIntervalSeconds: doc.evaluationIntervalSeconds,
      lastEvaluatedAt: doc.lastEvaluatedAt ? doc.lastEvaluatedAt.toISOString() : null,
      lastStateChangeAt: doc.lastStateChangeAt ? doc.lastStateChangeAt.toISOString() : null,
      lastEvaluatedValue: doc.lastEvaluatedValue,
      lastEvaluationMessage: doc.lastEvaluationMessage,
      tags: doc.tags,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async list(
    projectId: string,
    filters: {
      ruleType?: MonitorRuleType | undefined;
      state?: MonitorState | undefined;
      enabled?: boolean | undefined;
    } = {},
  ): Promise<MonitorRule[]> {
    const query: Record<string, unknown> = { projectId };
    if (filters.ruleType) query.ruleType = filters.ruleType;
    if (filters.state) query.state = filters.state;
    if (typeof filters.enabled === "boolean") query.enabled = filters.enabled;

    const docs = await MonitorModel.find(query).sort({ updatedAt: -1 });
    return docs.map((doc) => this.mapDocument(doc));
  }

  async findById(projectId: string, monitorId: string): Promise<MonitorRule | null> {
    const doc = await MonitorModel.findOne({ _id: monitorId, projectId });
    return doc ? this.mapDocument(doc) : null;
  }

  async create(
    input: Omit<
      MonitorRule,
      "id" | "createdAt" | "updatedAt" | "lastEvaluatedAt" | "lastStateChangeAt" | "state"
    > & { state?: MonitorState | undefined; description?: string | undefined },
  ): Promise<MonitorRule> {
    const doc = new MonitorModel({
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      severity: input.severity,
      state: input.state ?? "ok",
      enabled: input.enabled,
      condition: input.condition,
      evaluationIntervalSeconds: input.evaluationIntervalSeconds,
      tags: input.tags ?? [],
    });
    await doc.save();
    return this.mapDocument(doc);
  }

  async update(
    projectId: string,
    monitorId: string,
    input: Partial<{
      name: string;
      description?: string;
      ruleType: MonitorRuleType;
      severity: MonitorSeverity;
      enabled: boolean;
      condition: MonitorCondition;
      evaluationIntervalSeconds: number;
      tags: string[];
    }>,
  ): Promise<MonitorRule | null> {
    const doc = await MonitorModel.findOneAndUpdate(
      { _id: monitorId, projectId },
      { $set: input },
      { new: true },
    );
    return doc ? this.mapDocument(doc) : null;
  }

  async updateEvaluationState(
    projectId: string,
    monitorId: string,
    update: {
      state: MonitorState;
      evaluatedValue: number | null;
      evaluationMessage: string | null;
      stateChanged: boolean;
    },
  ): Promise<MonitorRule | null> {
    const now = new Date();
    const setQuery: Record<string, unknown> = {
      state: update.state,
      lastEvaluatedAt: now,
      lastEvaluatedValue: update.evaluatedValue,
      lastEvaluationMessage: update.evaluationMessage,
    };

    if (update.stateChanged) {
      setQuery.lastStateChangeAt = now;
    }

    const doc = await MonitorModel.findOneAndUpdate(
      { _id: monitorId, projectId },
      { $set: setQuery },
      { new: true },
    );
    return doc ? this.mapDocument(doc) : null;
  }

  async delete(projectId: string, monitorId: string): Promise<boolean> {
    const res = await MonitorModel.deleteOne({ _id: monitorId, projectId });
    return res.deletedCount > 0;
  }

  async listAllActive(): Promise<MonitorRule[]> {
    const docs = await MonitorModel.find({ enabled: true });
    return docs.map((doc) => this.mapDocument(doc));
  }
}
