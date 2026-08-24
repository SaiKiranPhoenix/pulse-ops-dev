import mongoose, { Schema, isValidObjectId, model, type Model } from "mongoose";

type AuthProjectRecord = {
  ownerId: string;
  status: "active" | "archived";
};

const authProjectSchema = new Schema<AuthProjectRecord>(
  {
    ownerId: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "archived"], required: true, index: true },
  },
  {
    collection: "auth_projects",
    versionKey: false,
  },
);

const AuthProjectModel: Model<AuthProjectRecord> =
  mongoose.models.RealtimeAuthProject ??
  model<AuthProjectRecord>("RealtimeAuthProject", authProjectSchema);

export interface ProjectAuthorizationRepository {
  canAccessProject(projectId: string, userId: string): Promise<boolean>;
}

export class MongoProjectAuthorizationRepository implements ProjectAuthorizationRepository {
  async canAccessProject(projectId: string, userId: string): Promise<boolean> {
    if (!isValidObjectId(projectId)) {
      return false;
    }

    const project = await AuthProjectModel.exists({
      _id: projectId,
      ownerId: userId,
      status: "active",
    }).exec();

    return project !== null;
  }
}
