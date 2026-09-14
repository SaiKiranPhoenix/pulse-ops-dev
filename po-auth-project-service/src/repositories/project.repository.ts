import { ProjectModel, type ProjectDocument, type ProjectRecord } from "../models/project.model.js";

export type CreateProjectRecordInput = {
  readonly ownerId: string;
  readonly organizationId?: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
};

export type SafeProjectRecord = {
  readonly id: string;
  readonly ownerId: string;
  readonly organizationId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: ProjectRecord["status"];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface ProjectRepository {
  create(input: CreateProjectRecordInput): Promise<SafeProjectRecord>;
  findById(projectId: string): Promise<SafeProjectRecord | null>;
  findByIdForOwner(projectId: string, ownerId: string): Promise<SafeProjectRecord | null>;
  findByIdForUser(projectId: string, userId: string): Promise<SafeProjectRecord | null>;
  findByOrganizationIds(organizationIds: string[], ownerId: string): Promise<SafeProjectRecord[]>;
  findByOwner(ownerId: string): Promise<SafeProjectRecord[]>;
  findBySlugForOrganization(
    slug: string,
    organizationId: string,
  ): Promise<SafeProjectRecord | null>;
  findBySlugForOwner(slug: string, ownerId: string): Promise<SafeProjectRecord | null>;
  updateStatus(
    projectId: string,
    ownerId: string,
    status: ProjectRecord["status"],
  ): Promise<SafeProjectRecord | null>;
}

export class MongoProjectRepository implements ProjectRepository {
  async create(input: CreateProjectRecordInput): Promise<SafeProjectRecord> {
    const project = await ProjectModel.create(input);
    return toSafeProjectRecord(project);
  }

  async findById(projectId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findById(projectId).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async findByIdForOwner(projectId: string, ownerId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({ _id: projectId, ownerId }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async findByIdForUser(projectId: string, userId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({
      _id: projectId,
      $or: [{ ownerId: userId }, { organizationId: { $ne: null } }],
    }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async findByOrganizationIds(
    organizationIds: string[],
    ownerId: string,
  ): Promise<SafeProjectRecord[]> {
    const projects = await ProjectModel.find({
      $or: [{ ownerId }, { organizationId: { $in: organizationIds } }],
    })
      .sort({ status: 1, createdAt: -1 })
      .exec();
    return projects.map(toSafeProjectRecord);
  }

  async findByOwner(ownerId: string): Promise<SafeProjectRecord[]> {
    const projects = await ProjectModel.find({ ownerId }).sort({ status: 1, createdAt: -1 }).exec();
    return projects.map(toSafeProjectRecord);
  }

  async findBySlugForOrganization(
    slug: string,
    organizationId: string,
  ): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({ organizationId, slug }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async findBySlugForOwner(slug: string, ownerId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({ ownerId, slug }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async updateStatus(
    projectId: string,
    ownerId: string,
    status: ProjectRecord["status"],
  ): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOneAndUpdate(
      { _id: projectId, ownerId },
      { $set: { status } },
      { new: true },
    ).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }
}

export function toSafeProjectRecord(project: ProjectDocument): SafeProjectRecord {
  return {
    id: project.id,
    ownerId: project.ownerId,
    organizationId: project.organizationId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
