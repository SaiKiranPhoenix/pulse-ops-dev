import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";
import type { TelemetryEventType } from "@pulseops/shared";

export type AcceptedIngestionEventRecord = {
  id: string;
  type: TelemetryEventType;
  source: string;
  fingerprint: string;
  observedAt: string;
  receivedAt: string;
};

export type IngestionAcceptanceRecord = {
  projectId: string;
  idempotencyKey: string;
  event: AcceptedIngestionEventRecord;
  createdAt: Date;
  updatedAt: Date;
};

export type IngestionAcceptanceDocument = HydratedDocument<IngestionAcceptanceRecord>;

const acceptedIngestionEventSchema = new Schema<AcceptedIngestionEventRecord>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["log", "error", "metric"], required: true },
    source: { type: String, required: true },
    fingerprint: { type: String, required: true },
    observedAt: { type: String, required: true },
    receivedAt: { type: String, required: true },
  },
  { _id: false, versionKey: false },
);

const ingestionAcceptanceSchema = new Schema<IngestionAcceptanceRecord>(
  {
    projectId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    event: { type: acceptedIngestionEventSchema, required: true },
  },
  {
    collection: "ingestion_acceptances",
    timestamps: true,
    versionKey: false,
  },
);

ingestionAcceptanceSchema.index(
  { projectId: 1, idempotencyKey: 1 },
  { unique: true, name: "uniq_ingestion_acceptances_project_idempotency" },
);

export const IngestionAcceptanceModel: Model<IngestionAcceptanceRecord> =
  mongoose.models.IngestionAcceptance ??
  model<IngestionAcceptanceRecord>("IngestionAcceptance", ingestionAcceptanceSchema);
