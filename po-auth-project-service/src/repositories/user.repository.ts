import { UserModel, type UserDocument, type UserRecord } from "../models/user.model.js";

export type CreateUserRecordInput = {
  readonly email: string;
  readonly name: string | null;
  readonly passwordHash: string;
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
  readonly passwordHash: string;
};

export interface UserRepository {
  findById(id: string): Promise<SafeUserRecord | null>;
  findByEmail(email: string): Promise<SafeUserRecord | null>;
  findByEmailWithPasswordHash(email: string): Promise<UserWithPasswordHashRecord | null>;
  create(input: CreateUserRecordInput): Promise<SafeUserRecord>;
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
