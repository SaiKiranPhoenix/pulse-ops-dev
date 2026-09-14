import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type IngestionApiKeyReadModelRecord = {
  projectId: string;
  ownerId: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  status: "active" | "disabled";
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IngestionApiKeyReadModelDocument = HydratedDocument<IngestionApiKeyReadModelRecord>;

const ingestionApiKeyReadModelSchema = new Schema<IngestionApiKeyReadModelRecord>(
  {
    projectId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true, select: false },
    keyPrefix: { type: String, required: true, index: true },
    scopes: { type: [String], required: true, default: [] },
    status: {
      type: String,
      enum: ["active", "disabled"],
      required: true,
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: "ingestion_api_key_read_models",
    timestamps: true,
    versionKey: false,
  },
);

export const IngestionApiKeyReadModelModel: Model<IngestionApiKeyReadModelRecord> =
  mongoose.models.AuthIngestionApiKeyReadModel ??
  model<IngestionApiKeyReadModelRecord>(
    "AuthIngestionApiKeyReadModel",
    ingestionApiKeyReadModelSchema,
  );
