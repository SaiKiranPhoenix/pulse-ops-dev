import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";
import type {
  VaultCapability,
  VaultPolicyHistoryItem,
  VaultPolicyRule,
} from "@pulseops/shared/types";

export interface VaultPolicyRecord {
  projectId: string;
  name: string;
  description?: string;
  rules: VaultPolicyRule[];
  version: number;
  isDefault: boolean;
  history: VaultPolicyHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

export type VaultPolicyDocument = HydratedDocument<VaultPolicyRecord>;

const ruleSchema = new Schema<VaultPolicyRule>(
  {
    path: { type: String, required: true },
    capabilities: {
      type: [String],
      enum: ["create", "read", "update", "delete", "list", "deny", "sudo"],
      required: true,
    },
    description: { type: String },
  },
  { _id: false },
);

const historySchema = new Schema<VaultPolicyHistoryItem>(
  {
    version: { type: Number, required: true },
    rules: { type: [ruleSchema], required: true },
    modifiedBy: { type: String, required: true },
    modifiedAt: { type: String, required: true },
  },
  { _id: false },
);

const vaultPolicySchema = new Schema<VaultPolicyRecord>(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    rules: { type: [ruleSchema], required: true, default: [] },
    version: { type: Number, required: true, default: 1 },
    isDefault: { type: Boolean, default: false },
    history: { type: [historySchema], default: [] },
  },
  {
    collection: "vault_policies",
    timestamps: true,
    versionKey: false,
  },
);

vaultPolicySchema.index(
  { projectId: 1, name: 1 },
  { unique: true, name: "idx_vault_policies_project_name" },
);

export const VaultPolicyModel: Model<VaultPolicyRecord> =
  mongoose.models.VaultPolicy ?? model<VaultPolicyRecord>("VaultPolicy", vaultPolicySchema);
