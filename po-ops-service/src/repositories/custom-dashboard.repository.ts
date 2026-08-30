import type { CustomDashboard, DashboardWidget } from "@pulseops/shared";
import {
  CustomDashboardModel,
  type CustomDashboardDocument,
} from "../models/custom-dashboard.model.js";

export class CustomDashboardRepository {
  async list(projectId: string): Promise<CustomDashboard[]> {
    const docs = await CustomDashboardModel.find({ projectId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean<CustomDashboardDocument[]>();
    return docs.map((doc) => this.toDto(doc));
  }

  async findById(projectId: string, id: string): Promise<CustomDashboard | null> {
    const doc = await CustomDashboardModel.findOne({ _id: id, projectId }).lean<CustomDashboardDocument | null>();
    return doc ? this.toDto(doc) : null;
  }

  async create(
    projectId: string,
    input: {
      name: string;
      description?: string;
      templateKey?: string;
      widgets?: DashboardWidget[];
      tags?: string[];
      refreshIntervalSeconds?: number;
      isDefault?: boolean;
    },
  ): Promise<CustomDashboard> {
    const doc = await CustomDashboardModel.create({
      projectId,
      name: input.name,
      description: input.description,
      templateKey: input.templateKey,
      widgets: input.widgets ?? [],
      tags: input.tags ?? [],
      refreshIntervalSeconds: input.refreshIntervalSeconds ?? 30,
      isDefault: input.isDefault ?? false,
    });
    return this.toDto(doc.toObject() as CustomDashboardDocument);
  }

  async update(
    projectId: string,
    id: string,
    input: Partial<{
      name: string;
      description?: string;
      templateKey?: string;
      widgets?: DashboardWidget[];
      tags?: string[];
      refreshIntervalSeconds?: number;
      isDefault?: boolean;
    }>,
  ): Promise<CustomDashboard | null> {
    const doc = await CustomDashboardModel.findOneAndUpdate(
      { _id: id, projectId },
      { $set: input },
      { new: true },
    ).lean<CustomDashboardDocument | null>();
    return doc ? this.toDto(doc) : null;
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    const res = await CustomDashboardModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }

  async clone(projectId: string, id: string, newName?: string): Promise<CustomDashboard | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;

    const cloned = await this.create(projectId, {
      name: newName ?? `${existing.name} (Copy)`,
      description: existing.description,
      templateKey: existing.templateKey,
      widgets: existing.widgets,
      tags: existing.tags,
      refreshIntervalSeconds: existing.refreshIntervalSeconds,
      isDefault: false,
    });

    return cloned;
  }

  private toDto(doc: CustomDashboardDocument): CustomDashboard {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      description: doc.description,
      templateKey: doc.templateKey,
      widgets: doc.widgets ?? [],
      tags: doc.tags ?? [],
      refreshIntervalSeconds: doc.refreshIntervalSeconds ?? 30,
      isDefault: doc.isDefault ?? false,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
