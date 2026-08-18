import mongoose, { Schema, model, type HydratedDocument, type Model } from "mongoose";

export type UserStatus = "active" | "disabled";
export type OAuthProvider = "google" | "github";

export type UserOAuthAccount = {
  provider: OAuthProvider;
  providerUserId: string;
  linkedAt: Date;
};

export type UserRecord = {
  email: string;
  name: string | null;
  passwordHash: string | null;
  oauthAccounts: UserOAuthAccount[];
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
      default: null,
      select: false,
    },
    oauthAccounts: {
      type: [
        {
          provider: {
            type: String,
            enum: ["google", "github"],
            required: true,
          },
          providerUserId: {
            type: String,
            required: true,
            trim: true,
            maxlength: 256,
          },
          linkedAt: {
            type: Date,
            required: true,
          },
        },
      ],
      default: [],
      select: false,
      _id: false,
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
userSchema.index(
  { "oauthAccounts.provider": 1, "oauthAccounts.providerUserId": 1 },
  {
    sparse: true,
    name: "idx_auth_users_oauth_account",
  },
);

export const UserModel: Model<UserRecord> =
  mongoose.models.User ?? model<UserRecord>("User", userSchema);
