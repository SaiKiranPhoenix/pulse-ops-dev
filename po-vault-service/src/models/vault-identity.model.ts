import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultIdentityType = "user" | "oauth" | "service-account" | "approle";

export type VaultIdentityRecord = {
  projectId: string;
  alias: string;
  type: VaultIdentityType;
  displayName: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultIdentityDocument = HydratedDocument<VaultIdentityRecord>;

const vaultIdentitySchema = new Schema<VaultIdentityRecord>(
  {
    projectId: { type: String, required: true, index: true },
    alias: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: ["user", "oauth", "service-account", "approle"],
      required: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    metadata: { type: Map, of: String, default: {} },
  },
  {
    collection: "vault_identities",
    timestamps: true,
    versionKey: false,
  },
);

vaultIdentitySchema.index(
  { projectId: 1, alias: 1 },
  { unique: true, name: "uniq_vault_identities_project_alias" },
);

export const VaultIdentityModel: Model<VaultIdentityRecord> =
  mongoose.models.VaultIdentity ?? model<VaultIdentityRecord>("VaultIdentity", vaultIdentitySchema);
