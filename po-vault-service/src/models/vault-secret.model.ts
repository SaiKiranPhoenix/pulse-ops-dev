import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type EncryptedSecretValue = {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
};

export type VaultSecretRecord = {
  projectId: string;
  environment: string;
  key: string;
  encryptedValue: EncryptedSecretValue;
  versions: VaultSecretVersionRecord[];
  version: number;
  status: "active" | "deleted";
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultSecretDocument = HydratedDocument<VaultSecretRecord>;

export type VaultSecretVersionRecord = {
  version: number;
  status: "rotated" | "deleted";
  actorId: string | null;
  occurredAt: Date;
};

const encryptedValueSchema = new Schema<EncryptedSecretValue>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    salt: { type: String, required: true },
  },
  { _id: false },
);

const vaultSecretSchema = new Schema<VaultSecretRecord>(
  {
    projectId: { type: String, required: true, index: true },
    environment: { type: String, required: true, trim: true, lowercase: true, index: true },
    key: { type: String, required: true, trim: true, index: true },
    encryptedValue: { type: encryptedValueSchema, required: true, select: false },
    versions: {
      type: [
        new Schema<VaultSecretVersionRecord>(
          {
            version: { type: Number, required: true, min: 1 },
            status: { type: String, enum: ["rotated", "deleted"], required: true },
            actorId: { type: String, default: null },
            occurredAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
      select: false,
    },
    version: { type: Number, required: true, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["active", "deleted"],
      required: true,
      default: "active",
      index: true,
    },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    collection: "vault_secrets",
    timestamps: true,
    versionKey: false,
  },
);

vaultSecretSchema.index(
  { projectId: 1, environment: 1, key: 1, status: 1 },
  { name: "idx_vault_secrets_lookup" },
);

export const VaultSecretModel: Model<VaultSecretRecord> =
  mongoose.models.VaultSecret ?? model<VaultSecretRecord>("VaultSecret", vaultSecretSchema);
