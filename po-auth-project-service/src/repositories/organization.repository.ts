import { OrganizationModel, type OrganizationDocument } from "../models/organization.model.js";

export type CreateOrganizationRecordInput = {
  readonly createdByUserId: string;
  readonly name: string;
  readonly slug: string;
};

export type SafeOrganizationRecord = {
  readonly id: string;
  readonly createdByUserId: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface OrganizationRepository {
  create(input: CreateOrganizationRecordInput): Promise<SafeOrganizationRecord>;
  findById(organizationId: string): Promise<SafeOrganizationRecord | null>;
  findBySlug(slug: string): Promise<SafeOrganizationRecord | null>;
  findDefaultForUser(userId: string): Promise<SafeOrganizationRecord | null>;
}

export class MongoOrganizationRepository implements OrganizationRepository {
  async create(input: CreateOrganizationRecordInput): Promise<SafeOrganizationRecord> {
    const organization = await OrganizationModel.create(input);
    return toSafeOrganizationRecord(organization);
  }

  async findById(organizationId: string): Promise<SafeOrganizationRecord | null> {
    const organization = await OrganizationModel.findById(organizationId).exec();
    return organization === null ? null : toSafeOrganizationRecord(organization);
  }

  async findBySlug(slug: string): Promise<SafeOrganizationRecord | null> {
    const organization = await OrganizationModel.findOne({ slug }).exec();
    return organization === null ? null : toSafeOrganizationRecord(organization);
  }

  async findDefaultForUser(userId: string): Promise<SafeOrganizationRecord | null> {
    const organization = await OrganizationModel.findOne({ createdByUserId: userId })
      .sort({ createdAt: 1 })
      .exec();
    return organization === null ? null : toSafeOrganizationRecord(organization);
  }
}

export function toSafeOrganizationRecord(
  organization: OrganizationDocument,
): SafeOrganizationRecord {
  return {
    id: organization.id,
    createdByUserId: organization.createdByUserId,
    name: organization.name,
    slug: organization.slug,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}
