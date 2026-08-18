import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export type UserStatus = "active" | "disabled";

export type UserRecord = {
  email: string;
  name: string | null;
  passwordHash: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<UserRecord>;

const userSchema = new Schema<UserRecord>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      maxlength: 320,
    },
    name: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      required: true,
      index: true,
    },
  },
  {
    collection: "auth_users",
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true, name: "uniq_auth_users_email" });

export const UserModel: Model<UserRecord> = models.User ?? model<UserRecord>("User", userSchema);
