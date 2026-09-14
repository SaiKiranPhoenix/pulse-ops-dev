import {
  UserModel,
  type OAuthProvider,
  type UserDocument,
  type UserOAuthAccount,
  type UserRecord,
} from "../models/user.model.js";

export type CreateUserRecordInput = {
  readonly email: string;
  readonly name: string | null;
  readonly passwordHash: string;
};

export type CreateOAuthUserRecordInput = {
  readonly email: string;
  readonly name: string | null;
  readonly oauthAccount: CreateOAuthAccountInput;
};

export type CreateOAuthAccountInput = {
  readonly provider: OAuthProvider;
  readonly providerUserId: string;
};

export type SafeUserRecord = {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly status: UserRecord["status"];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type UserWithPasswordHashRecord = SafeUserRecord & {
  readonly passwordHash: string | null;
};

export interface UserRepository {
  findById(id: string): Promise<SafeUserRecord | null>;
  findByEmail(email: string): Promise<SafeUserRecord | null>;
  findByOAuthAccount(input: CreateOAuthAccountInput): Promise<SafeUserRecord | null>;
  findByEmailWithPasswordHash(email: string): Promise<UserWithPasswordHashRecord | null>;
  create(input: CreateUserRecordInput): Promise<SafeUserRecord>;
  createFromOAuth(input: CreateOAuthUserRecordInput): Promise<SafeUserRecord>;
  linkOAuthAccount(userId: string, input: CreateOAuthAccountInput): Promise<SafeUserRecord | null>;
  updateProfile(
    userId: string,
    input: { readonly name: string | null },
  ): Promise<SafeUserRecord | null>;
}

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<SafeUserRecord | null> {
    const user = await UserModel.findById(id).exec();
    return user === null ? null : toSafeUserRecord(user);
  }

  async findByEmail(email: string): Promise<SafeUserRecord | null> {
    const user = await UserModel.findOne({ email }).exec();
    return user === null ? null : toSafeUserRecord(user);
  }

  async findByOAuthAccount(input: CreateOAuthAccountInput): Promise<SafeUserRecord | null> {
    const user = await UserModel.findOne({
      oauthAccounts: {
        $elemMatch: {
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      },
    }).exec();

    return user === null ? null : toSafeUserRecord(user);
  }

  async findByEmailWithPasswordHash(email: string): Promise<UserWithPasswordHashRecord | null> {
    const user = await UserModel.findOne({ email }).select("+passwordHash").exec();
    return user === null ? null : { ...toSafeUserRecord(user), passwordHash: user.passwordHash };
  }

  async create(input: CreateUserRecordInput): Promise<SafeUserRecord> {
    const user = await UserModel.create({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
    });

    return toSafeUserRecord(user);
  }

  async createFromOAuth(input: CreateOAuthUserRecordInput): Promise<SafeUserRecord> {
    const user = await UserModel.create({
      email: input.email,
      name: input.name,
      passwordHash: null,
      oauthAccounts: [toOAuthAccountRecord(input.oauthAccount)],
    });

    return toSafeUserRecord(user);
  }

  async linkOAuthAccount(
    userId: string,
    input: CreateOAuthAccountInput,
  ): Promise<SafeUserRecord | null> {
    await UserModel.updateOne(
      {
        _id: userId,
        oauthAccounts: {
          $not: {
            $elemMatch: {
              provider: input.provider,
              providerUserId: input.providerUserId,
            },
          },
        },
      },
      {
        $push: {
          oauthAccounts: toOAuthAccountRecord(input),
        },
      },
    ).exec();

    return this.findById(userId);
  }

  async updateProfile(
    userId: string,
    input: { readonly name: string | null },
  ): Promise<SafeUserRecord | null> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { name: input.name } },
      { new: true },
    ).exec();

    return user === null ? null : toSafeUserRecord(user);
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === 11000
  );
}

function toSafeUserRecord(user: UserDocument): SafeUserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toOAuthAccountRecord(input: CreateOAuthAccountInput): UserOAuthAccount {
  return {
    provider: input.provider,
    providerUserId: input.providerUserId,
    linkedAt: new Date(),
  };
}
