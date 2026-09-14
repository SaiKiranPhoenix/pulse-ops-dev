import { conflict } from "@pulseops/shared";
import {
  isDuplicateKeyError,
  type SafeUserRecord,
  type UserRepository,
} from "../repositories/user.repository.js";
import type { PasswordHasher } from "./password-hasher.service.js";

export type RegisterUserInput = {
  readonly email: string;
  readonly password: string;
  readonly name?: string | undefined;
};

export type RegisteredUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: string;
};

export class UserRegistrationService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(input: RegisterUserInput): Promise<RegisteredUser> {
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name);
    const existingUser = await this.users.findByEmail(email);

    if (existingUser !== null) {
      throw conflict("Email is already registered");
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    try {
      const user = await this.users.create({ email, name, passwordHash });
      return toRegisteredUser(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict("Email is already registered");
      }

      throw error;
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string | undefined): string | null {
  const normalized = name?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function toRegisteredUser(user: SafeUserRecord): RegisteredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
