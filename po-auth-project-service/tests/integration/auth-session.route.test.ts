import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createTestDependencies,
  registeredUser,
  validTestCredential,
} from "../support/test-dependencies.js";

describe("auth sessions", () => {
  it("logs in with valid credentials and returns the current user with bearer auth", async () => {
    const harness = createTestDependencies();
    harness.users.seed(
      registeredUser({
        email: "sai@example.com",
        name: "Sai",
      }),
    );
    const app = createApp({ dependencies: harness.dependencies });

    const loginResponse = await request(app)
      .post("/auth/login")
      .set("x-request-id", "req_login")
      .send({
        email: "SAI@example.com",
        password: validTestCredential(),
      })
      .expect(200);

    expect(loginResponse.body.data.user).toEqual({
      id: "000000000000000000000001",
      email: "sai@example.com",
      name: "Sai",
      createdAt: "2026-08-18T00:00:00.000Z",
    });
    expect(loginResponse.body.data.tokenType).toBe("Bearer");
    expect(typeof loginResponse.body.data.accessToken).toBe("string");

    const currentUserResponse = await request(app)
      .get("/auth/me")
      .set("authorization", `Bearer ${String(loginResponse.body.data.accessToken)}`)
      .set("x-request-id", "req_me")
      .expect(200);

    expect(currentUserResponse.body).toEqual({
      data: {
        user: {
          id: "000000000000000000000001",
          email: "sai@example.com",
          name: "Sai",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
      },
      requestId: "req_me",
    });
  });

  it("rejects invalid credentials without revealing which field failed", async () => {
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

    const response = await request(app)
      .post("/auth/login")
      .set("x-request-id", "req_invalid_login")
      .send({
        email: "missing@example.com",
        password: validTestCredential(),
      })
      .expect(401);

    expect(response.body).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      },
      requestId: "req_invalid_login",
    });
  });
});
