import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";
import type { TelemetryEventType } from "@pulseops/shared";

export type EventRecord = {
  messageId: string;
  projectId: string;
  ownerId: string;
  type: TelemetryEventType;
  source: string;
  level: string | null;
  message: string | null;
  name: string | null;
  value: number | null;
  unit: string | null;
  fingerprint: string;
  attributes: Record<string, unknown>;
  observedAt: Date;
  idempotencyKey: string | null;
  receivedAt: Date;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type EventDocument = HydratedDocument<EventRecord>;

const eventSchema = new Schema<EventRecord>(
  {
    messageId: { type: String, required: true, unique: true },
    projectId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    type: { type: String, enum: ["log", "error", "metric"], required: true, index: true },
    source: { type: String, required: true, trim: true, maxlength: 160 },
    level: { type: String, default: null, trim: true, maxlength: 40 },
    message: { type: String, default: null, trim: true, maxlength: 4_000 },
    name: { type: String, default: null, trim: true, maxlength: 160 },
    value: { type: Number, default: null },
    unit: { type: String, default: null, trim: true, maxlength: 40 },
    fingerprint: { type: String, required: true, index: true },
    attributes: { type: Schema.Types.Mixed, required: true, default: {} },
    observedAt: { type: Date, required: true, index: true },
    idempotencyKey: { type: String, default: null, index: true },
    receivedAt: { type: Date, required: true, index: true },
    processedAt: { type: Date, required: true, index: true },
  },
  {
    collection: "ingested_events",
    timestamps: true,
    versionKey: false,
  },
);

eventSchema.index(
  { projectId: 1, type: 1, receivedAt: -1 },
  { name: "idx_events_project_type_received" },
);
eventSchema.index(
  { projectId: 1, fingerprint: 1, receivedAt: -1 },
  { name: "idx_events_project_fingerprint_received" },
);

export const EventModel: Model<EventRecord> =
  mongoose.models.WorkerEvent ?? model<EventRecord>("WorkerEvent", eventSchema);
