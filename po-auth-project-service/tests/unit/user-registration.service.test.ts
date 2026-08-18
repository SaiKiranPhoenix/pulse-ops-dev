import { describe, expect, it } from "vitest";
import { UserRegistrationService } from "../../src/services/user-registration.service.js";
import type {
  CreateUserRecordInput,
  SafeUserRecord,
  UserRepository,
} from "../../src/repositories/user.repository.js";
import type { PasswordHasher } from "../../src/services/password-hasher.service.js";

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, SafeUserRecord>();
  readonly createdInputs: CreateUserRecordInput[] = [];

  seed(user: SafeUserRecord): void {
    this.users.set(user.email, user);
  }

  async findByEmail(email: string): Promise<SafeUserRecord | null> {
    return this.users.get(email) ?? null;
  }

  async create(input: CreateUserRecordInput): Promise<SafeUserRecord> {
    this.createdInputs.push(input);

    const now = new Date("2026-08-18T00:00:00.000Z");
    const user: SafeUserRecord = {
      id: "usr_123",
      email: input.email,
      name: input.name,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(input.email, user);
    return user;
  }
}

class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    return storedHash === `hashed:${password}`;
  }
}

describe("UserRegistrationService", () => {
  it("normalizes email/name and stores only the password hash", async () => {
    const repository = new InMemoryUserRepository();
    const service = createService(repository);

    const result = await service.register({
      email: "  USER@Example.COM ",
      name: "  Sai Kiran  ",
      password: validTestCredential(),
    });

    expect(result).toEqual({
      id: "usr_123",
      email: "user@example.com",
      name: "Sai Kiran",
      createdAt: "2026-08-18T00:00:00.000Z",
    });
    expect(repository.createdInputs).toEqual([
      {
        email: "user@example.com",
        name: "Sai Kiran",
        passwordHash: `hashed:${validTestCredential()}`,
      },
    ]);
  });

  it("rejects duplicate email registration", async () => {
    const repository = new InMemoryUserRepository();
    repository.seed(registeredUser({ email: "user@example.com" }));
    const service = createService(repository);

    await expect(
      service.register({
        email: "USER@example.com",
        password: validTestCredential(),
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
      message: "Email is already registered",
    });
  });
});

function createService(repository: UserRepository): UserRegistrationService {
  return new UserRegistrationService(repository, new FakePasswordHasher());
}

function validTestCredential(): string {
  return ["Secure", "Pass", "123", "!"].join("");
}

function registeredUser(overrides: Partial<SafeUserRecord> = {}): SafeUserRecord {
  const now = new Date("2026-08-18T00:00:00.000Z");

  return {
    id: "usr_existing",
    email: "existing@example.com",
    name: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
