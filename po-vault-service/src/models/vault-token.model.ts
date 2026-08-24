import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultTokenStatus = "active" | "revoked";

export type VaultTokenRecord = {
  projectId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  environments: string[];
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

export const VaultTokenModel: Model<VaultTokenRecord> =
  mongoose.models.VaultToken ?? model<VaultTokenRecord>("VaultToken", vaultTokenSchema);
