import type {
  SliDefinition,
  SloCalculation,
  SloDocumentData,
  SloHistoryPoint,
  SloStatus,
  SloTarget,
} from "@pulseops/shared";
import { SloModel, type SloDocument } from "../models/slo.model.js";

export class SloRepository {
  async list(
    projectId: string,
    filters: {
      serviceName?: string;
      environment?: string;
      status?: SloStatus;
      enabled?: boolean;
    } = {},
  ): Promise<SloDocumentData[]> {
    const query: Record<string, unknown> = { projectId };

    if (filters.serviceName) {
      query["sli.serviceName"] = filters.serviceName;
    }
    if (filters.environment) {
      query["sli.environment"] = filters.environment;
    }
    if (filters.enabled !== undefined) {
      query.enabled = filters.enabled;
    }
    if (filters.status) {
      query["calculation.status"] = filters.status;
    }

    const docs = await SloModel.find(query).sort({ createdAt: -1 }).lean<SloDocument[]>();
    return docs.map((doc) => this.toDto(doc));
  }

  async findById(projectId: string, id: string): Promise<SloDocumentData | null> {
    const doc = await SloModel.findOne({ _id: id, projectId }).lean<SloDocument | null>();
    return doc ? this.toDto(doc) : null;
  }

  async create(
    projectId: string,
    input: {
      name: string;
      description?: string;
      sli: SliDefinition;
      target: SloTarget;
      tags?: string[];
      enabled?: boolean;
    },
  ): Promise<SloDocumentData> {
    const doc = await SloModel.create({
      projectId,
      name: input.name,
      description: input.description,
      sli: input.sli,
      target: input.target,
      tags: input.tags ?? [],
      enabled: input.enabled ?? true,
      history: [],
    });
    return this.toDto(doc.toObject() as SloDocument);
  }

  async update(
    projectId: string,
    id: string,
    input: Partial<{
      name: string;
      description?: string;
      sli: SliDefinition;
      target: SloTarget;
      tags?: string[];
      enabled?: boolean;
    }>,
  ): Promise<SloDocumentData | null> {
    const doc = await SloModel.findOneAndUpdate(
      { _id: id, projectId },
      { $set: input },
      { new: true },
    ).lean<SloDocument | null>();
    return doc ? this.toDto(doc) : null;
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    const res = await SloModel.deleteOne({ _id: id, projectId });
    return res.deletedCount > 0;
  }

  async updateCalculation(
    projectId: string,
    id: string,
    calc: SloCalculation,
    historyPoint: SloHistoryPoint,
  ): Promise<SloDocumentData | null> {
    const doc = await SloModel.findOneAndUpdate(
      { _id: id, projectId },
      {
        $set: { calculation: calc },
        $push: {
          history: {
            $each: [historyPoint],
            $slice: -100, // keep latest 100 historical data points
          },
        },
      },
      { new: true },
    ).lean<SloDocument | null>();

    return doc ? this.toDto(doc) : null;
  }

  private toDto(doc: SloDocument): SloDocumentData {
    return {
      id: doc._id.toString(),
      projectId: doc.projectId,
      name: doc.name,
      description: doc.description,
      sli: doc.sli,
      target: doc.target,
      tags: doc.tags ?? [],
      enabled: doc.enabled,
      calculation: doc.calculation ?? null,
      history: doc.history ?? [],
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
