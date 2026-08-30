import type { NotificationChannel, NotificationRoutingRule } from "@pulseops/shared";
import {
  NotificationChannelModel,
  NotificationRoutingRuleModel,
  type NotificationChannelDocument,
  type NotificationRoutingRuleDocument,
} from "../models/notification-channel.model.js";

export class NotificationChannelRepository {
  private mapChannel(doc: NotificationChannelDocument): NotificationChannel {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      type: doc.type,
      config: doc.config,
      enabled: doc.enabled,
      lastDispatchedAt: doc.lastDispatchedAt ? doc.lastDispatchedAt.toISOString() : null,
      lastDispatchStatus: doc.lastDispatchStatus,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private mapRoutingRule(doc: NotificationRoutingRuleDocument): NotificationRoutingRule {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      channelIds: doc.channelIds,
      matchers: doc.matchers,
      enabled: doc.enabled,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async listChannels(projectId: string): Promise<NotificationChannel[]> {
    const docs = await NotificationChannelModel.find({ projectId }).sort({ updatedAt: -1 });
    return docs.map((doc) => this.mapChannel(doc));
  }

  async findChannelById(projectId: string, id: string): Promise<NotificationChannel | null> {
    const doc = await NotificationChannelModel.findOne({ _id: id, projectId });
    return doc ? this.mapChannel(doc) : null;
  }

  async createChannel(
    input: Omit<
      NotificationChannel,
      "id" | "createdAt" | "updatedAt" | "lastDispatchedAt" | "lastDispatchStatus"
    >,
  ): Promise<NotificationChannel> {
    const doc = await NotificationChannelModel.create(input);
    return this.mapChannel(doc);
  }

  async updateChannel(
    projectId: string,
    id: string,
    input: Partial<Omit<NotificationChannel, "id" | "projectId" | "createdAt" | "updatedAt">>,
  ): Promise<NotificationChannel | null> {
    const doc = await NotificationChannelModel.findOneAndUpdate(
      { _id: id, projectId },
      { $set: input },
      { new: true },
    );
    return doc ? this.mapChannel(doc) : null;
  }

  async updateDispatchStatus(id: string, status: "success" | "failed"): Promise<void> {
    await NotificationChannelModel.updateOne(
      { _id: id },
      { $set: { lastDispatchedAt: new Date(), lastDispatchStatus: status } },
    );
  }

  async deleteChannel(projectId: string, id: string): Promise<boolean> {
    const res = await NotificationChannelModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }

  async listRoutingRules(projectId: string): Promise<NotificationRoutingRule[]> {
    const docs = await NotificationRoutingRuleModel.find({ projectId }).sort({ updatedAt: -1 });
    return docs.map((doc) => this.mapRoutingRule(doc));
  }

  async createRoutingRule(
    input: Omit<NotificationRoutingRule, "id" | "createdAt" | "updatedAt">,
  ): Promise<NotificationRoutingRule> {
    const doc = await NotificationRoutingRuleModel.create(input);
    return this.mapRoutingRule(doc);
  }

  async updateRoutingRule(
    projectId: string,
    id: string,
    input: Partial<Omit<NotificationRoutingRule, "id" | "projectId" | "createdAt" | "updatedAt">>,
  ): Promise<NotificationRoutingRule | null> {
    const doc = await NotificationRoutingRuleModel.findOneAndUpdate(
      { _id: id, projectId },
      { $set: input },
      { new: true },
    );
    return doc ? this.mapRoutingRule(doc) : null;
  }

  async deleteRoutingRule(projectId: string, id: string): Promise<boolean> {
    const res = await NotificationRoutingRuleModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }
}
