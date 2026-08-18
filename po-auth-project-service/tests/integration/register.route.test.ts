import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { AuthController } from "../../src/controllers/auth.controller.js";
import type { AuthProjectServiceDependencies } from "../../src/services/dependencies.js";
import { UserRegistrationService } from "../../src/services/user-registration.service.js";
import type {
  CreateUserRecordInput,
  SafeUserRecord,
  UserRepository,
} from "../../src/repositories/user.repository.js";
import type { PasswordHasher } from "../../src/services/password-hasher.service.js";

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, SafeUserRecord>();

  async findByEmail(email: string): Promise<SafeUserRecord | null> {
    return this.users.get(email) ?? null;
  }

  async create(input: CreateUserRecordInput): Promise<SafeUserRecord> {
    const now = new Date("2026-08-18T00:00:00.000Z");
    const user: SafeUserRecord = {
      id: "usr_route",
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
  async hash(): Promise<string> {
    return "hashed-password";
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

describe("POST /auth/register", () => {
  it("creates a user and never returns the password hash", async () => {
    const app = createApp({ dependencies: createTestDependencies() });

    const response = await request(app)
      .post("/auth/register")
      .set("x-request-id", "req_test")
      .send({
        email: "USER@example.com",
        name: "Sai",
        password: validTestCredential(),
      })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        user: {
          id: "usr_route",
          email: "user@example.com",
          name: "Sai",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
      },
      requestId: "req_test",
    });
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("returns validation errors for weak passwords", async () => {
    const app = createApp({ dependencies: createTestDependencies() });

    const response = await request(app)
      .post("/auth/register")
      .set("x-request-id", "req_validation")
      .send({
        email: "user@example.com",
        password: "weak",
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      },
      requestId: "req_validation",
    });
  });
});

function createTestDependencies(): AuthProjectServiceDependencies {
  const service = new UserRegistrationService(
    new InMemoryUserRepository(),
    new FakePasswordHasher(),
  );

  return {
    authController: new AuthController(service),
    userRegistrationService: service,
  };
}

function validTestCredential(): string {
  return ["Secure", "Pass", "123", "!"].join("");
}
