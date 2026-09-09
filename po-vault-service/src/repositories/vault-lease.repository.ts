import {
  VaultLeaseModel,
  type VaultLeaseDocument,
  type VaultLeaseRecord,
} from "../models/vault-lease.model.js";

export type CreateVaultLeaseInput = {
  readonly leaseId: string;
  readonly projectId: string;
  readonly environment: string;
  readonly tokenId: string;
  readonly tokenPrefix: string;
  readonly identityAlias: string;
  readonly secretKeys: string[];
  readonly ttlSeconds: number;
  readonly renewable: boolean;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
};

export type SafeVaultLeaseRecord = VaultLeaseRecord & {
  readonly id: string;
};

export interface VaultLeaseRepository {
  create(input: CreateVaultLeaseInput): Promise<SafeVaultLeaseRecord>;
  findActive(projectId: string, leaseId: string): Promise<SafeVaultLeaseRecord | null>;
  list(projectId: string): Promise<SafeVaultLeaseRecord[]>;
  renew(
    projectId: string,
    leaseId: string,
    expiresAt: Date,
    renewedAt: Date,
  ): Promise<SafeVaultLeaseRecord | null>;
  revoke(
    projectId: string,
    leaseId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<SafeVaultLeaseRecord | null>;
  expireDue(now: Date): Promise<SafeVaultLeaseRecord[]>;
}

export class MongoVaultLeaseRepository implements VaultLeaseRepository {
  async create(input: CreateVaultLeaseInput): Promise<SafeVaultLeaseRecord> {
    const lease = await VaultLeaseModel.create({
      ...input,
      status: "active",
      renewedAt: null,
      revokedAt: null,
      revokeReason: null,
    });
    return toSafeVaultLeaseRecord(lease);
  }

  async findActive(projectId: string, leaseId: string): Promise<SafeVaultLeaseRecord | null> {
    const lease = await VaultLeaseModel.findOne({ projectId, leaseId, status: "active" }).exec();
    return lease === null ? null : toSafeVaultLeaseRecord(lease);
  }

  async list(projectId: string): Promise<SafeVaultLeaseRecord[]> {
    const leases = await VaultLeaseModel.find({ projectId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .exec();
    return leases.map(toSafeVaultLeaseRecord);
  }

  async renew(
    projectId: string,
    leaseId: string,
    expiresAt: Date,
    renewedAt: Date,
  ): Promise<SafeVaultLeaseRecord | null> {
    const lease = await VaultLeaseModel.findOneAndUpdate(
      { projectId, leaseId, status: "active", renewable: true },
      { $set: { expiresAt, renewedAt } },
      { new: true },
    ).exec();
    return lease === null ? null : toSafeVaultLeaseRecord(lease);
  }

  async revoke(
    projectId: string,
    leaseId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<SafeVaultLeaseRecord | null> {
    const lease = await VaultLeaseModel.findOneAndUpdate(
      { projectId, leaseId, status: "active" },
      { $set: { status: "revoked", revokedAt, revokeReason: reason } },
      { new: true },
    ).exec();
    return lease === null ? null : toSafeVaultLeaseRecord(lease);
  }

  async expireDue(now: Date): Promise<SafeVaultLeaseRecord[]> {
    const dueLeases = await VaultLeaseModel.find({
      status: "active",
      expiresAt: { $lte: now },
    }).exec();
    if (dueLeases.length === 0) {
      return [];
    }

    const leaseIds = dueLeases.map((lease) => lease.leaseId);
    await VaultLeaseModel.updateMany(
      { leaseId: { $in: leaseIds }, status: "active" },
      { $set: { status: "expired", revokeReason: "ttl expired" } },
    ).exec();

    const expired = await VaultLeaseModel.find({ leaseId: { $in: leaseIds } }).exec();
    return expired.map(toSafeVaultLeaseRecord);
  }
}

function toSafeVaultLeaseRecord(lease: VaultLeaseDocument): SafeVaultLeaseRecord {
  return {
    id: lease.id,
    leaseId: lease.leaseId,
    projectId: lease.projectId,
    environment: lease.environment,
    tokenId: lease.tokenId,
    tokenPrefix: lease.tokenPrefix,
    identityAlias: lease.identityAlias,
    secretKeys: [...lease.secretKeys],
    status: lease.status,
    ttlSeconds: lease.ttlSeconds,
    renewable: lease.renewable,
    issuedAt: lease.issuedAt,
    expiresAt: lease.expiresAt,
    renewedAt: lease.renewedAt,
    revokedAt: lease.revokedAt,
    revokeReason: lease.revokeReason,
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt,
  };
}
