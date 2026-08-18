import { ProjectModel, type ProjectDocument, type ProjectRecord } from "../models/project.model.js";

export type CreateProjectRecordInput = {
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
};

export type SafeProjectRecord = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly slug: string;
  readonly status: ProjectRecord["status"];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface ProjectRepository {
  create(input: CreateProjectRecordInput): Promise<SafeProjectRecord>;
  findByIdForOwner(projectId: string, ownerId: string): Promise<SafeProjectRecord | null>;
  findByOwner(ownerId: string): Promise<SafeProjectRecord[]>;
  findBySlugForOwner(slug: string, ownerId: string): Promise<SafeProjectRecord | null>;
}

export class MongoProjectRepository implements ProjectRepository {
  async create(input: CreateProjectRecordInput): Promise<SafeProjectRecord> {
    const project = await ProjectModel.create(input);
    return toSafeProjectRecord(project);
  }

  async findByIdForOwner(projectId: string, ownerId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({ _id: projectId, ownerId }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }

  async findByOwner(ownerId: string): Promise<SafeProjectRecord[]> {
    const projects = await ProjectModel.find({ ownerId }).sort({ createdAt: -1 }).exec();
    return projects.map(toSafeProjectRecord);
  }

  async findBySlugForOwner(slug: string, ownerId: string): Promise<SafeProjectRecord | null> {
    const project = await ProjectModel.findOne({ ownerId, slug }).exec();
    return project === null ? null : toSafeProjectRecord(project);
  }
}

export function toSafeProjectRecord(project: ProjectDocument): SafeProjectRecord {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    slug: project.slug,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
