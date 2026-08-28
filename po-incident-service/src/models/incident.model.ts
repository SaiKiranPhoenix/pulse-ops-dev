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
  eventCount: number;
  creationReason: string;
  acknowledgedAt: Date | null;
  resolutionNote: string | null;
  samples: IncidentEventSample[];
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
