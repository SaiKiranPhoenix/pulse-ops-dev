import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultTokenStatus = "active" | "revoked";

export type VaultTokenRecord = {
  projectId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  environments: string[];
  authMethod: "integration-token" | "service-account" | "approle";
  identityAlias: string;
  parentTokenId: string | null;
  ttlSeconds: number;
  maxTtlSeconds: number;
  renewable: boolean;
  issuedAt: Date;
  renewedAt: Date | null;
  status: VaultTokenStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultTokenDocument = HydratedDocument<VaultTokenRecord>;

const vaultTokenSchema = new Schema<VaultTokenRecord>(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    tokenPrefix: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    scopes: { type: [String], required: true, default: [] },
    environments: { type: [String], required: true, default: [] },
    authMethod: {
      type: String,
      enum: ["integration-token", "service-account", "approle"],
      required: true,
      default: "integration-token",
      index: true,
    },
    identityAlias: { type: String, required: true, default: "integration:unknown", index: true },
    parentTokenId: { type: String, default: null, index: true },
    ttlSeconds: { type: Number, required: true, default: 3600 },
    maxTtlSeconds: { type: Number, required: true, default: 86400 },
    renewable: { type: Boolean, required: true, default: true, index: true },
    issuedAt: { type: Date, required: true, default: Date.now },
    renewedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "revoked"],
      required: true,
      default: "active",
      index: true,
    },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  {
    collection: "vault_tokens",
    timestamps: true,
    versionKey: false,
  },
);

vaultTokenSchema.index(
  { projectId: 1, status: 1, createdAt: -1 },
  { name: "idx_vault_tokens_project_status_created" },
);
vaultTokenSchema.index(
  { projectId: 1, identityAlias: 1, status: 1 },
  { name: "idx_vault_tokens_project_identity_status" },
);

export const VaultTokenModel: Model<VaultTokenRecord> =
  mongoose.models.VaultToken ?? model<VaultTokenRecord>("VaultToken", vaultTokenSchema);
