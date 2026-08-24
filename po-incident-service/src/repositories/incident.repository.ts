import {
  IncidentModel,
  type IncidentDocument,
  type IncidentRecord,
  type IncidentStatus,
} from "../models/incident.model.js";

export type CreateIncidentRecordInput = {
  readonly projectId: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly summary: string | null;
  readonly severity: IncidentRecord["severity"];
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
};

export type UpsertOpenIncidentRecordInput = CreateIncidentRecordInput;

export type IncidentFilter = {
  readonly projectId: string;
  readonly status?: IncidentStatus | undefined;
};

export type SafeIncidentRecord = IncidentRecord & {
  readonly id: string;
};

export interface IncidentRepository {
  create(input: CreateIncidentRecordInput): Promise<SafeIncidentRecord>;
  upsertOpen(input: UpsertOpenIncidentRecordInput): Promise<SafeIncidentRecord>;
  findById(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null>;
  findMany(filter: IncidentFilter): Promise<SafeIncidentRecord[]>;
  resolve(
    projectId: string,
    incidentId: string,
    resolvedAt: Date,
  ): Promise<SafeIncidentRecord | null>;
  reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null>;
}

export class MongoIncidentRepository implements IncidentRepository {
  async create(input: CreateIncidentRecordInput): Promise<SafeIncidentRecord> {
    const incident = await IncidentModel.create(input);
    return toSafeIncidentRecord(incident);
  }

  async upsertOpen(input: UpsertOpenIncidentRecordInput): Promise<SafeIncidentRecord> {
    try {
      const incident = await IncidentModel.findOneAndUpdate(
        {
          projectId: input.projectId,
          fingerprint: input.fingerprint,
          status: "open",
        },
        {
          $set: {
            title: input.title,
            summary: input.summary,
            severity: input.severity,
            lastSeenAt: input.lastSeenAt,
          },
          $setOnInsert: {
            projectId: input.projectId,
            fingerprint: input.fingerprint,
            firstSeenAt: input.firstSeenAt,
            resolvedAt: null,
          },
          $inc: { eventCount: 1 },
        },
        { new: true, setDefaultsOnInsert: true, upsert: true },
      ).exec();

      if (incident === null) {
        throw new Error("Failed to upsert incident");
      }

      return toSafeIncidentRecord(incident);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const incidentAfterRace = await IncidentModel.findOneAndUpdate(
          {
            projectId: input.projectId,
            fingerprint: input.fingerprint,
            status: "open",
          },
          {
            $set: {
              title: input.title,
              summary: input.summary,
              severity: input.severity,
              lastSeenAt: input.lastSeenAt,
            },
            $inc: { eventCount: 1 },
          },
          { new: true },
        ).exec();

        if (incidentAfterRace !== null) {
          return toSafeIncidentRecord(incidentAfterRace);
        }
      }

      throw error;
    }
  }

  async findById(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOne({ _id: incidentId, projectId }).exec();
    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async findMany(filter: IncidentFilter): Promise<SafeIncidentRecord[]> {
    const query = {
      projectId: filter.projectId,
      ...(filter.status === undefined ? {} : { status: filter.status }),
    };
    const incidents = await IncidentModel.find(query).sort({ lastSeenAt: -1 }).limit(100).exec();
    return incidents.map(toSafeIncidentRecord);
  }

  async resolve(
    projectId: string,
    incidentId: string,
    resolvedAt: Date,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      { $set: { status: "resolved", resolvedAt } },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      { $set: { status: "open", resolvedAt: null } },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }
}

function toSafeIncidentRecord(incident: IncidentDocument): SafeIncidentRecord {
  return {
    id: incident.id,
    projectId: incident.projectId,
    fingerprint: incident.fingerprint,
    title: incident.title,
    summary: incident.summary,
    severity: incident.severity,
    status: incident.status,
    eventCount: incident.eventCount,
    firstSeenAt: incident.firstSeenAt,
    lastSeenAt: incident.lastSeenAt,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === 11000
  );
}
