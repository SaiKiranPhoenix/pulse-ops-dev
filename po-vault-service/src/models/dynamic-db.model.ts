import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";
import type { DynamicDatabaseCredential } from "@pulseops/shared/types";

export type DynamicDbRecord = DynamicDatabaseCredential & {
  status: "active" | "revoked" | "expired";
  createdAt: string;
};

export type DynamicDbDocument = HydratedDocument<DynamicDbRecord>;

const dynamicDbSchema = new Schema<DynamicDbRecord>(
  {
    leaseId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    engine: { type: String, enum: ["postgres", "mysql", "mongodb"], required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    ttlSeconds: { type: Number, required: true },
    expiresAt: { type: String, required: true },
    renewable: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
  },
  {
    collection: "vault_dynamic_credentials",
    timestamps: true,
    versionKey: false,
  },
);

export const DynamicDbModel: Model<DynamicDbRecord> =
  mongoose.models.DynamicDbCredential ?? model<DynamicDbRecord>("DynamicDbCredential", dynamicDbSchema);
