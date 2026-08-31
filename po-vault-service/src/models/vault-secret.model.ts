import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type EncryptedSecretValue = {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
};

export type SecretMetadataRecord = {
  maxVersions?: number;
  casRequired?: boolean;
  deleteProtection?: boolean;
  customMetadata?: Record<string, string>;
  expiresAt?: Date | null;
  ttlSeconds?: number;
  rotationPeriodDays?: number;
  nextRotationDate?: Date | null;
  autoRotateEnabled?: boolean;
};

export type VaultSecretRecord = {
  projectId: string;
  environment: string;
  key: string;
  encryptedValue: EncryptedSecretValue;
  versions: VaultSecretVersionRecord[];
  metadata?: SecretMetadataRecord;
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
  status: "rotated" | "deleted" | "destroyed";
  isDeleted?: boolean;
  destroyedAt?: Date | null;
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
            status: { type: String, enum: ["rotated", "deleted", "destroyed"], required: true },
            isDeleted: { type: Boolean, default: false },
            destroyedAt: { type: Date, default: null },
            actorId: { type: String, default: null },
            occurredAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
      select: false,
    },
    metadata: {
      type: new Schema<SecretMetadataRecord>(
        {
          maxVersions: { type: Number, default: 10 },
          casRequired: { type: Boolean, default: false },
          deleteProtection: { type: Boolean, default: false },
          customMetadata: { type: Map, of: String, default: {} },
          expiresAt: { type: Date, default: null },
          ttlSeconds: { type: Number, default: null },
          rotationPeriodDays: { type: Number, default: null },
          nextRotationDate: { type: Date, default: null },
          autoRotateEnabled: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: {},
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
