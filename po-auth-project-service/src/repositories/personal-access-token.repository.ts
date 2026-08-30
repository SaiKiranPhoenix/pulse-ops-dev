import {
  PersonalAccessTokenModel,
  type PersonalAccessTokenDocument,
  type PersonalAccessTokenRecord,
} from "../models/personal-access-token.model.js";

export type CreatePersonalAccessTokenRecordInput = {
  readonly userId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly tokenHash: string;
  readonly scopes: string[];
  readonly expiresAt: Date | null;
};

export type SafePersonalAccessTokenRecord = {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: string[];
  readonly status: PersonalAccessTokenRecord["status"];
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface PersonalAccessTokenRepository {
  create(input: CreatePersonalAccessTokenRecordInput): Promise<SafePersonalAccessTokenRecord>;
  findByUserOrganization(
    userId: string,
    organizationId: string,
  ): Promise<SafePersonalAccessTokenRecord[]>;
  revoke(
    tokenId: string,
    userId: string,
    organizationId: string,
  ): Promise<SafePersonalAccessTokenRecord | null>;
}

export class MongoPersonalAccessTokenRepository implements PersonalAccessTokenRepository {
  async create(
    input: CreatePersonalAccessTokenRecordInput,
  ): Promise<SafePersonalAccessTokenRecord> {
    const token = await PersonalAccessTokenModel.create(input);
    return toSafePersonalAccessTokenRecord(token);
  }

  async findByUserOrganization(
    userId: string,
    organizationId: string,
  ): Promise<SafePersonalAccessTokenRecord[]> {
    const tokens = await PersonalAccessTokenModel.find({ userId, organizationId })
      .sort({ createdAt: -1 })
      .exec();
    return tokens.map(toSafePersonalAccessTokenRecord);
  }

  async revoke(
    tokenId: string,
    userId: string,
    organizationId: string,
  ): Promise<SafePersonalAccessTokenRecord | null> {
    const token = await PersonalAccessTokenModel.findOneAndUpdate(
      { _id: tokenId, userId, organizationId },
      { $set: { status: "revoked" } },
      { new: true },
    ).exec();
    return token === null ? null : toSafePersonalAccessTokenRecord(token);
  }
}

export function toSafePersonalAccessTokenRecord(
  token: PersonalAccessTokenDocument,
): SafePersonalAccessTokenRecord {
  return {
    id: token.id,
    userId: token.userId,
    organizationId: token.organizationId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: [...token.scopes],
    status: token.status,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}
