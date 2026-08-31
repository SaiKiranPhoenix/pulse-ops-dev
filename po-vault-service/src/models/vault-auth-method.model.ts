import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultAuthMethodType = "service-account" | "approle";
export type VaultAuthMethodStatus = "active" | "disabled";

export type VaultAuthMethodRecord = {
  projectId: string;
  type: VaultAuthMethodType;
  name: string;
  identityAlias: string;
  roleId: string | null;
  secretIdHash: string | null;
  tokenScopes: string[];
  tokenEnvironments: string[];
  tokenTtlSeconds: number;
  tokenMaxTtlSeconds: number;
  renewable: boolean;
  status: VaultAuthMethodStatus;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultAuthMethodDocument = HydratedDocument<VaultAuthMethodRecord>;

const vaultAuthMethodSchema = new Schema<VaultAuthMethodRecord>(
  {
    projectId: { type: String, required: true, index: true },
    type: { type: String, enum: ["service-account", "approle"], required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    identityAlias: { type: String, required: true, trim: true, maxlength: 160, index: true },
    roleId: { type: String, default: null, index: true },
    secretIdHash: { type: String, default: null, select: false },
    tokenScopes: { type: [String], required: true, default: [] },
    tokenEnvironments: { type: [String], required: true, default: [] },
    tokenTtlSeconds: { type: Number, required: true, default: 3600 },
    tokenMaxTtlSeconds: { type: Number, required: true, default: 86400 },
    renewable: { type: Boolean, required: true, default: true },
    status: {
      type: String,
      enum: ["active", "disabled"],
      required: true,
      default: "active",
      index: true,
    },
    lastUsedAt: { type: Date, default: null },
  },
  {
    collection: "vault_auth_methods",
    timestamps: true,
    versionKey: false,
  },
);

vaultAuthMethodSchema.index(
  { projectId: 1, identityAlias: 1 },
  { unique: true, name: "uniq_vault_auth_methods_project_alias" },
);
vaultAuthMethodSchema.index(
  { projectId: 1, roleId: 1 },
  { unique: true, sparse: true, name: "uniq_vault_auth_methods_project_role" },
);

export const VaultAuthMethodModel: Model<VaultAuthMethodRecord> =
  mongoose.models.VaultAuthMethod ??
  model<VaultAuthMethodRecord>("VaultAuthMethod", vaultAuthMethodSchema);
