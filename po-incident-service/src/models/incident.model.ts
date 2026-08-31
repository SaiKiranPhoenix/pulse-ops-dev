import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export type IncidentEventSample = {
  eventId: string;
  telemetryMessageId: string;
  source: string;
  level: string | null;
  message: string | null;
  observedAt: Date;
  receivedAt: Date;
};

export type IncidentRecord = {
  projectId: string;
  fingerprint: string;
  title: string;
  summary: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignee: string | null;
  runbookUrl: string | null;
  eventCount: number;
  creationReason: string;
  acknowledgedAt: Date | null;
  resolutionNote: string | null;
  samples: IncidentEventSample[];
  timeline: Array<{
    id: string;
    incidentId: string;
    timestamp: string;
    type: string;
    actor: string;
    description: string;
    metadata?: Record<string, unknown>;
  }>;
  comments: Array<{
    id: string;
    incidentId: string;
    userId: string;
    userName: string;
    message: string;
    createdAt: string;
  }>;
  relatedResources: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    metadata?: Record<string, unknown>;
  }>;
  postmortem: {
    incidentId: string;
    summary: string;
    rootCause: string;
    trigger: string;
    impactDurationMinutes: number;
    detectionTimeMinutes: number;
    resolutionTimeMinutes: number;
    actionItems: Array<{ id: string; description: string; assignee?: string; completed: boolean }>;
    status: string;
    updatedAt: string;
  } | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IncidentDocument = HydratedDocument<IncidentRecord>;

const incidentSchema = new Schema<IncidentRecord>(
  {
    projectId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    summary: { type: String, default: null, trim: true, maxlength: 1_000 },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      required: true,
      default: "open",
      index: true,
    },
    assignee: { type: String, default: null },
    runbookUrl: { type: String, default: null },
    eventCount: { type: Number, required: true, min: 1, default: 1 },
    creationReason: {
      type: String,
      required: true,
      default: "Repeated error telemetry matched by fingerprint",
      trim: true,
      maxlength: 240,
    },
    acknowledgedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null, trim: true, maxlength: 1_000 },
    samples: {
      type: [
        new Schema<IncidentEventSample>(
          {
            eventId: { type: String, required: true },
            telemetryMessageId: { type: String, required: true },
            source: { type: String, required: true },
            level: { type: String, default: null },
            message: { type: String, default: null },
            observedAt: { type: Date, required: true },
            receivedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    timeline: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            incidentId: { type: String, required: true },
            timestamp: { type: String, required: true },
            type: { type: String, required: true },
            actor: { type: String, required: true },
            description: { type: String, required: true },
            metadata: { type: Schema.Types.Mixed, default: undefined },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    comments: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            incidentId: { type: String, required: true },
            userId: { type: String, required: true },
            userName: { type: String, required: true },
            message: { type: String, required: true },
            createdAt: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    relatedResources: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            type: { type: String, required: true },
            title: { type: String, required: true },
            url: { type: String, required: true },
            metadata: { type: Schema.Types.Mixed, default: undefined },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    postmortem: {
      type: new Schema(
        {
          incidentId: { type: String, required: true },
          summary: { type: String, required: true },
          rootCause: { type: String, required: true },
          trigger: { type: String, required: true },
          impactDurationMinutes: { type: Number, required: true },
          detectionTimeMinutes: { type: Number, required: true },
          resolutionTimeMinutes: { type: Number, required: true },
          actionItems: { type: [Schema.Types.Mixed], default: [] },
          status: { type: String, required: true },
          updatedAt: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    firstSeenAt: { type: Date, required: true, index: true },
    lastSeenAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null },
  },
  {
    collection: "incidents",
    timestamps: true,
    versionKey: false,
  },
);

incidentSchema.index(
  { projectId: 1, fingerprint: 1 },
  {
    name: "uniq_incidents_open_project_fingerprint",
    unique: true,
    partialFilterExpression: { status: { $in: ["open", "acknowledged"] } },
  },
);
incidentSchema.index(
  { projectId: 1, status: 1, lastSeenAt: -1 },
  { name: "idx_incidents_project_status_last_seen" },
);
incidentSchema.index({ projectId: 1, lastSeenAt: -1 }, { name: "idx_incidents_project_last_seen" });
incidentSchema.index(
  { projectId: 1, fingerprint: 1, lastSeenAt: -1 },
  { name: "idx_incidents_project_fingerprint_last_seen" },
);
incidentSchema.index(
  { projectId: 1, "samples.eventId": 1 },
  { name: "idx_incidents_project_sample_event" },
);

export const IncidentModel: Model<IncidentRecord> =
  mongoose.models.Incident ?? model<IncidentRecord>("Incident", incidentSchema);
