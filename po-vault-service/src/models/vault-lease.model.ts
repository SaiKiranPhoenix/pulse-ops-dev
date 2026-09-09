import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultLeaseRecord = {
  leaseId: string;
  projectId: string;
  environment: string;
  tokenId: string;
  tokenPrefix: string;
  identityAlias: string;
  secretKeys: string[];
  status: "active" | "revoked" | "expired";
  ttlSeconds: number;
  renewable: boolean;
  issuedAt: Date;
  expiresAt: Date;
  renewedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultLeaseDocument = HydratedDocument<VaultLeaseRecord>;

const vaultLeaseSchema = new Schema<VaultLeaseRecord>(
  {
    leaseId: { type: String, required: true, unique: true },
    projectId: { type: String, required: true, index: true },
    environment: { type: String, required: true, index: true },
    tokenId: { type: String, required: true, index: true },
    tokenPrefix: { type: String, required: true, index: true },
    identityAlias: { type: String, required: true, index: true },
    secretKeys: { type: [String], required: true, default: [] },
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      required: true,
      default: "active",
      index: true,
    },
    ttlSeconds: { type: Number, required: true, min: 60 },
    renewable: { type: Boolean, required: true, default: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    renewedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
  },
  {
    collection: "vault_leases",
    timestamps: true,
    versionKey: false,
  },
);

vaultLeaseSchema.index(
  { projectId: 1, status: 1, expiresAt: 1 },
  { name: "idx_vault_leases_project_status_expiry" },
);
vaultLeaseSchema.index(
  { projectId: 1, environment: 1, updatedAt: -1 },
  { name: "idx_vault_leases_project_env_recent" },
);
vaultLeaseSchema.index(
  { projectId: 1, tokenId: 1, updatedAt: -1 },
  { name: "idx_vault_leases_project_token_recent" },
);

export const VaultLeaseModel: Model<VaultLeaseRecord> =
  mongoose.models.VaultLease ?? model<VaultLeaseRecord>("VaultLease", vaultLeaseSchema);
