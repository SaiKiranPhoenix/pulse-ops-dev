import type { MaintenanceWindow, SilenceWindow } from "@pulseops/shared";
import {
  MaintenanceWindowModel,
  SilenceWindowModel,
  type MaintenanceWindowDocument,
  type SilenceWindowDocument,
} from "../models/silence-window.model.js";

export class SilenceWindowRepository {
  private mapSilence(doc: SilenceWindowDocument): SilenceWindow {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      matchers: doc.matchers,
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      reason: doc.reason,
      createdBy: doc.createdBy,
      enabled: doc.enabled,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private mapMaintenance(doc: MaintenanceWindowDocument): MaintenanceWindow {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      services: doc.services,
      environments: doc.environments,
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      suppressIncidents: doc.suppressIncidents,
      suppressNotifications: doc.suppressNotifications,
      reason: doc.reason,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async listSilence(projectId: string): Promise<SilenceWindow[]> {
    const docs = await SilenceWindowModel.find({ projectId }).sort({ endsAt: -1 });
    return docs.map((doc) => this.mapSilence(doc));
  }

  async createSilence(
    input: Omit<SilenceWindow, "id" | "createdAt" | "updatedAt">,
  ): Promise<SilenceWindow> {
    const doc = await SilenceWindowModel.create({
      ...input,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
    return this.mapSilence(doc);
  }

  async deleteSilence(projectId: string, id: string): Promise<boolean> {
    const res = await SilenceWindowModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }

  async listActiveSilence(projectId: string, atTime: Date = new Date()): Promise<SilenceWindow[]> {
    const docs = await SilenceWindowModel.find({
      projectId,
      enabled: true,
      startsAt: { $lte: atTime },
      endsAt: { $gte: atTime },
    });
    return docs.map((doc) => this.mapSilence(doc));
  }

  async listMaintenance(projectId: string): Promise<MaintenanceWindow[]> {
    const docs = await MaintenanceWindowModel.find({ projectId }).sort({ endsAt: -1 });
    return docs.map((doc) => this.mapMaintenance(doc));
  }

  async createMaintenance(
    input: Omit<MaintenanceWindow, "id" | "createdAt" | "updatedAt">,
  ): Promise<MaintenanceWindow> {
    const doc = await MaintenanceWindowModel.create({
      ...input,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
    return this.mapMaintenance(doc);
  }

  async deleteMaintenance(projectId: string, id: string): Promise<boolean> {
    const res = await MaintenanceWindowModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }

  async listActiveMaintenance(
    projectId: string,
    atTime: Date = new Date(),
  ): Promise<MaintenanceWindow[]> {
    const docs = await MaintenanceWindowModel.find({
      projectId,
      startsAt: { $lte: atTime },
      endsAt: { $gte: atTime },
    });
    return docs.map((doc) => this.mapMaintenance(doc));
  }
}
