import {
  ServiceModel,
  type ServiceChecklistItem,
  type ServiceDocument,
  type ServiceLanguage,
  type ServiceRecord,
  type ServiceRuntime,
  type ServiceStatus,
  type ServiceTier,
} from "../models/service.model.js";
import { DashboardEventModel } from "../models/dashboard-read.model.js";

export type SafeServiceRecord = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly ownerName: string | null;
  readonly ownerEmail: string | null;
  readonly ownerTeam: string | null;
  readonly language: ServiceLanguage;
  readonly runtime: ServiceRuntime;
  readonly tier: ServiceTier;
  readonly repoUrl: string | null;
  readonly runbookUrl: string | null;
  readonly deploymentUrl: string | null;
  readonly tags: string[];
  readonly onboardingChecklist: ServiceChecklistItem[];
  readonly isAutoDiscovered: boolean;
  readonly status: ServiceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateOrUpdateServiceInput = {
  readonly projectId: string;
  readonly name: string;
  readonly displayName?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly ownerName?: string | null | undefined;
  readonly ownerEmail?: string | null | undefined;
  readonly ownerTeam?: string | null | undefined;
  readonly language?: ServiceLanguage | undefined;
  readonly runtime?: ServiceRuntime | undefined;
  readonly tier?: ServiceTier | undefined;
  readonly repoUrl?: string | null | undefined;
  readonly runbookUrl?: string | null | undefined;
  readonly deploymentUrl?: string | null | undefined;
  readonly tags?: string[] | undefined;
  readonly onboardingChecklist?: ServiceChecklistItem[] | undefined;
  readonly isAutoDiscovered?: boolean | undefined;
  readonly status?: ServiceStatus | undefined;
};

export interface ServiceRepository {
  findServicesForProject(projectId: string): Promise<SafeServiceRecord[]>;
  findServiceByName(projectId: string, name: string): Promise<SafeServiceRecord | null>;
  upsertService(input: CreateOrUpdateServiceInput): Promise<SafeServiceRecord>;
  deleteService(projectId: string, name: string): Promise<boolean>;
  listDistinctSources(projectId: string): Promise<string[]>;
}

export class MongoServiceRepository implements ServiceRepository {
  async findServicesForProject(projectId: string): Promise<SafeServiceRecord[]> {
    const records = await ServiceModel.find({
      projectId,
      status: { $ne: "archived" },
    })
      .sort({ name: 1 })
      .exec();

    return records.map(toSafeServiceRecord);
  }

  async findServiceByName(projectId: string, name: string): Promise<SafeServiceRecord | null> {
    const record = await ServiceModel.findOne({
      projectId,
      name: name.toLowerCase().trim(),
    }).exec();

    return record === null ? null : toSafeServiceRecord(record);
  }

  async upsertService(input: CreateOrUpdateServiceInput): Promise<SafeServiceRecord> {
    const normalizedName = input.name.toLowerCase().trim();
    const updatePayload: Record<string, unknown> = {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
      ...(input.ownerEmail !== undefined ? { ownerEmail: input.ownerEmail } : {}),
      ...(input.ownerTeam !== undefined ? { ownerTeam: input.ownerTeam } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.runtime !== undefined ? { runtime: input.runtime } : {}),
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      ...(input.repoUrl !== undefined ? { repoUrl: input.repoUrl } : {}),
      ...(input.runbookUrl !== undefined ? { runbookUrl: input.runbookUrl } : {}),
      ...(input.deploymentUrl !== undefined ? { deploymentUrl: input.deploymentUrl } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.onboardingChecklist !== undefined
        ? { onboardingChecklist: input.onboardingChecklist }
        : {}),
      ...(input.isAutoDiscovered !== undefined ? { isAutoDiscovered: input.isAutoDiscovered } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };

    const setOnInsert: Record<string, unknown> = {
      projectId: input.projectId,
      name: normalizedName,
    };
    if (input.language === undefined) setOnInsert.language = "other";
    if (input.runtime === undefined) setOnInsert.runtime = "docker";
    if (input.tier === undefined) setOnInsert.tier = "tier_2";
    if (input.tags === undefined) setOnInsert.tags = [];
    if (input.onboardingChecklist === undefined)
      setOnInsert.onboardingChecklist = defaultChecklist();
    if (input.isAutoDiscovered === undefined) setOnInsert.isAutoDiscovered = false;
    if (input.status === undefined) setOnInsert.status = "active";

    const updateQuery: Record<string, unknown> = { $setOnInsert: setOnInsert };
    if (Object.keys(updatePayload).length > 0) {
      updateQuery.$set = updatePayload;
    }

    const record = await ServiceModel.findOneAndUpdate(
      { projectId: input.projectId, name: normalizedName },
      updateQuery,
      { upsert: true, returnDocument: "after" },
    ).exec();

    return toSafeServiceRecord(record);
  }

  async deleteService(projectId: string, name: string): Promise<boolean> {
    const res = await ServiceModel.deleteOne({
      projectId,
      name: name.toLowerCase().trim(),
    }).exec();

    return res.deletedCount > 0;
  }

  async listDistinctSources(projectId: string): Promise<string[]> {
    const sources = await DashboardEventModel.distinct("source", { projectId }).exec();
    return sources
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().toLowerCase());
  }
}

export function defaultChecklist(): ServiceChecklistItem[] {
  return [
    {
      id: "telemetry",
      title: "Instrument Telemetry (Logs, Metrics, Errors, Traces)",
      completed: true,
      completedAt: new Date(),
    },
    {
      id: "owner",
      title: "Assign Service Owner & Contact",
      completed: false,
      completedAt: null,
    },
    {
      id: "runbook",
      title: "Link Incident Runbook Documentation",
      completed: false,
      completedAt: null,
    },
    {
      id: "alerts",
      title: "Configure Alert Rules & Pager Routing",
      completed: false,
      completedAt: null,
    },
    {
      id: "tier",
      title: "Define SLA Tier & Criticality",
      completed: true,
      completedAt: new Date(),
    },
  ];
}

export function toSafeServiceRecord(
  record: ServiceDocument | (ServiceRecord & { _id?: unknown; id?: string }),
): SafeServiceRecord {
  const id =
    "id" in record && typeof record.id === "string" && record.id ? record.id : String(record._id);

  return {
    id,
    projectId: record.projectId,
    name: record.name,
    displayName: record.displayName,
    description: record.description,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    ownerTeam: record.ownerTeam,
    language: record.language,
    runtime: record.runtime,
    tier: record.tier,
    repoUrl: record.repoUrl,
    runbookUrl: record.runbookUrl,
    deploymentUrl: record.deploymentUrl,
    tags: [...record.tags],
    onboardingChecklist: record.onboardingChecklist.map((item) => ({
      id: item.id,
      title: item.title,
      completed: item.completed,
      completedAt: item.completedAt,
    })),
    isAutoDiscovered: record.isAutoDiscovered,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
