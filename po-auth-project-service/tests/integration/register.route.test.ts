import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createTestDependencies, validTestCredential } from "../support/test-dependencies.js";

describe("POST /auth/register", () => {
  it("creates a user and never returns the password hash", async () => {
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

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
          id: "000000000000000000000001",
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
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

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
