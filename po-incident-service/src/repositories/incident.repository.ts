import {
  IncidentModel,
  type IncidentDocument,
  type IncidentEventSample,
  type IncidentRecord,
  type IncidentStatus,
} from "../models/incident.model.js";

export type CreateIncidentRecordInput = {
  readonly projectId: string;
  readonly fingerprint: string;
  readonly title: string;
  readonly summary: string | null;
  readonly severity: IncidentRecord["severity"];
  readonly creationReason: string;
  readonly sample: IncidentEventSample;
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
    resolutionNote: string | null,
  ): Promise<SafeIncidentRecord | null>;
  acknowledge(
    projectId: string,
    incidentId: string,
    acknowledgedAt: Date,
  ): Promise<SafeIncidentRecord | null>;
  reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null>;
  triage(
    projectId: string,
    incidentId: string,
    input: {
      severity?: IncidentRecord["severity"];
      assignee?: string | null;
      runbookUrl?: string | null;
    },
  ): Promise<SafeIncidentRecord | null>;
  addComment(
    projectId: string,
    incidentId: string,
    comment: IncidentRecord["comments"][number],
  ): Promise<SafeIncidentRecord | null>;
  addTimelineEntry(
    projectId: string,
    incidentId: string,
    entry: IncidentRecord["timeline"][number],
  ): Promise<SafeIncidentRecord | null>;
  savePostmortem(
    projectId: string,
    incidentId: string,
    postmortem: NonNullable<IncidentRecord["postmortem"]>,
  ): Promise<SafeIncidentRecord | null>;
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
          status: { $in: ["open", "acknowledged"] },
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
            creationReason: input.creationReason,
            firstSeenAt: input.firstSeenAt,
            resolvedAt: null,
            acknowledgedAt: null,
            resolutionNote: null,
            assignee: null,
            runbookUrl: null,
            timeline: [
              {
                id: `tl_${Date.now()}`,
                incidentId: "",
                timestamp: new Date().toISOString(),
                type: "created",
                actor: "PulseOps Incident Bot",
                description: `Incident created from ${input.creationReason}`,
              },
            ],
            comments: [],
            relatedResources: [],
            postmortem: null,
          },
          $inc: { eventCount: 1 },
          $push: { samples: { $each: [input.sample], $slice: -8 } },
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
            status: { $in: ["open", "acknowledged"] },
          },
          {
            $set: {
              title: input.title,
              summary: input.summary,
              severity: input.severity,
              lastSeenAt: input.lastSeenAt,
            },
            $inc: { eventCount: 1 },
            $push: { samples: { $each: [input.sample], $slice: -8 } },
          },
          { new: true },
        ).exec();

        if (incidentAfterRace === null) {
          throw new Error("Failed to upsert incident after duplicate key race");
        }

        return toSafeIncidentRecord(incidentAfterRace);
      }

      throw error;
    }
  }

  async findById(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOne({ _id: incidentId, projectId }).exec();
    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async findMany(filter: IncidentFilter): Promise<SafeIncidentRecord[]> {
    const query: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.status !== undefined) {
      query.status = filter.status;
    }

    const incidents = await IncidentModel.find(query).sort({ lastSeenAt: -1 }).limit(100).exec();
    return incidents.map(toSafeIncidentRecord);
  }

  async resolve(
    projectId: string,
    incidentId: string,
    resolvedAt: Date,
    resolutionNote: string | null,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId, status: { $in: ["open", "acknowledged"] } },
      {
        $set: { status: "resolved", resolvedAt, resolutionNote },
        $push: {
          timeline: {
            id: `tl_${Date.now()}`,
            incidentId,
            timestamp: resolvedAt.toISOString(),
            type: "resolved",
            actor: "Responder",
            description: resolutionNote
              ? `Incident resolved: ${resolutionNote}`
              : "Incident resolved",
          },
        },
      },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async acknowledge(
    projectId: string,
    incidentId: string,
    acknowledgedAt: Date,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId, status: "open" },
      {
        $set: { status: "acknowledged", acknowledgedAt },
        $push: {
          timeline: {
            id: `tl_${Date.now()}`,
            incidentId,
            timestamp: acknowledgedAt.toISOString(),
            type: "acknowledged",
            actor: "Responder",
            description: "Incident acknowledged by on-call responder",
          },
        },
      },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async reopen(projectId: string, incidentId: string): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      {
        $set: { status: "open", resolvedAt: null, acknowledgedAt: null, resolutionNote: null },
        $push: {
          timeline: {
            id: `tl_${Date.now()}`,
            incidentId,
            timestamp: new Date().toISOString(),
            type: "reopened",
            actor: "Responder",
            description: "Incident reopened",
          },
        },
      },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async triage(
    projectId: string,
    incidentId: string,
    input: {
      severity?: IncidentRecord["severity"];
      assignee?: string | null;
      runbookUrl?: string | null;
    },
  ): Promise<SafeIncidentRecord | null> {
    const updateObj: Record<string, unknown> = {};
    const timelineEntries: Array<IncidentRecord["timeline"][number]> = [];

    if (input.severity !== undefined) {
      updateObj.severity = input.severity;
      timelineEntries.push({
        id: `tl_${Date.now()}_sev`,
        incidentId,
        timestamp: new Date().toISOString(),
        type: "severity_changed",
        actor: "Responder",
        description: `Severity adjusted to ${input.severity.toUpperCase()}`,
      });
    }

    if (input.assignee !== undefined) {
      updateObj.assignee = input.assignee;
      timelineEntries.push({
        id: `tl_${Date.now()}_ass`,
        incidentId,
        timestamp: new Date().toISOString(),
        type: "assigned",
        actor: "Responder",
        description: input.assignee ? `Assigned to ${input.assignee}` : "Unassigned",
      });
    }

    if (input.runbookUrl !== undefined) {
      updateObj.runbookUrl = input.runbookUrl;
    }

    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      {
        $set: updateObj,
        ...(timelineEntries.length > 0 ? { $push: { timeline: { $each: timelineEntries } } } : {}),
      },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async addComment(
    projectId: string,
    incidentId: string,
    comment: IncidentRecord["comments"][number],
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      {
        $push: {
          comments: comment,
          timeline: {
            id: `tl_${Date.now()}`,
            incidentId,
            timestamp: comment.createdAt,
            type: "comment_added",
            actor: comment.userName,
            description: `Commented: "${comment.message.slice(0, 80)}${comment.message.length > 80 ? "..." : ""}"`,
          },
        },
      },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async addTimelineEntry(
    projectId: string,
    incidentId: string,
    entry: IncidentRecord["timeline"][number],
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      { $push: { timeline: entry } },
      { new: true },
    ).exec();

    return incident === null ? null : toSafeIncidentRecord(incident);
  }

  async savePostmortem(
    projectId: string,
    incidentId: string,
    postmortem: NonNullable<IncidentRecord["postmortem"]>,
  ): Promise<SafeIncidentRecord | null> {
    const incident = await IncidentModel.findOneAndUpdate(
      { _id: incidentId, projectId },
      { $set: { postmortem } },
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
    assignee: incident.assignee ?? null,
    runbookUrl: incident.runbookUrl ?? null,
    eventCount: incident.eventCount,
    creationReason: incident.creationReason,
    acknowledgedAt: incident.acknowledgedAt,
    resolutionNote: incident.resolutionNote,
    samples: incident.samples,
    timeline: incident.timeline ?? [],
    comments: incident.comments ?? [],
    relatedResources: incident.relatedResources ?? [],
    postmortem: incident.postmortem ?? null,
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
