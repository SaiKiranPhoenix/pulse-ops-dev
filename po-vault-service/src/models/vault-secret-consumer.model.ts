import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type VaultSecretConsumerRecord = {
  projectId: string;
  environment: string;
  secretKey: string;
  tokenId: string;
  tokenPrefix: string;
  identityAlias: string;
  fetchCount: number;
  lastFetchedAt: Date;
  lastLeaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultSecretConsumerDocument = HydratedDocument<VaultSecretConsumerRecord>;

const vaultSecretConsumerSchema = new Schema<VaultSecretConsumerRecord>(
  {
    projectId: { type: String, required: true, index: true },
    environment: { type: String, required: true, index: true },
    secretKey: { type: String, required: true, index: true },
    tokenId: { type: String, required: true, index: true },
    tokenPrefix: { type: String, required: true },
    identityAlias: { type: String, required: true, index: true },
    fetchCount: { type: Number, required: true, default: 0, min: 0 },
    lastFetchedAt: { type: Date, required: true, index: true },
    lastLeaseId: { type: String, default: null },
  },
  {
    collection: "vault_secret_consumers",
    timestamps: true,
    versionKey: false,
  },
);

vaultSecretConsumerSchema.index(
  { projectId: 1, environment: 1, secretKey: 1, tokenId: 1 },
  { name: "idx_vault_secret_consumers_unique", unique: true },
);
vaultSecretConsumerSchema.index(
  { projectId: 1, lastFetchedAt: -1 },
  { name: "idx_vault_secret_consumers_project_recent" },
);

export const VaultSecretConsumerModel: Model<VaultSecretConsumerRecord> =
  mongoose.models.VaultSecretConsumer ??
  model<VaultSecretConsumerRecord>("VaultSecretConsumer", vaultSecretConsumerSchema);
