import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "resolved";

export type IncidentRecord = {
  projectId: string;
  fingerprint: string;
  title: string;
  summary: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  eventCount: number;
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
      enum: ["open", "resolved"],
      required: true,
      default: "open",
      index: true,
    },
    eventCount: { type: Number, required: true, min: 1, default: 1 },
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
  { projectId: 1, fingerprint: 1, status: 1 },
  { name: "idx_incidents_project_fingerprint_status" },
);

export const IncidentModel: Model<IncidentRecord> =
  mongoose.models.Incident ?? model<IncidentRecord>("Incident", incidentSchema);
