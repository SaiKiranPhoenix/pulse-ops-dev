import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createTestDependencies,
  registeredUser,
  validTestCredential,
} from "../support/test-dependencies.js";

describe("project and API key routes", () => {
  it("creates projects and returns a one-time raw API key only on creation", async () => {
    const harness = createTestDependencies();
    harness.users.seed(registeredUser({ email: "owner@example.com", name: "Owner" }));
    const app = createApp({ dependencies: harness.dependencies });
    const accessToken = await login(app);

    const projectResponse = await request(app)
      .post("/projects")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_project")
      .send({
        name: "Checkout API",
      })
      .expect(201);

    expect(projectResponse.body.data.project).toMatchObject({
      id: "000000000000000000000014",
      name: "Checkout API",
      slug: "checkout-api",
      status: "active",
    });

    const apiKeyResponse = await request(app)
      .post("/projects/000000000000000000000014/api-keys")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_key")
      .send({
        name: "Local ingestion",
      })
      .expect(201);

    expect(apiKeyResponse.body.data.apiKey).toMatchObject({
      id: "000000000000000000000028",
      projectId: "000000000000000000000014",
      name: "Local ingestion",
      status: "active",
    });
    expect(apiKeyResponse.body.data.rawKey).toMatch(/^po_live_/);

    const listKeysResponse = await request(app)
      .get("/projects/000000000000000000000014/api-keys")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_list_keys")
      .expect(200);

    expect(JSON.stringify(listKeysResponse.body)).not.toContain(
      String(apiKeyResponse.body.data.rawKey),
    );
    expect(listKeysResponse.body.data.apiKeys).toHaveLength(1);
  });

  it("requires authentication for project access", async () => {
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

    const response = await request(app)
      .get("/projects")
      .set("x-request-id", "req_no_auth")
      .expect(401);

    expect(response.body).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
      requestId: "req_no_auth",
    });
  });
});

async function login(app: Parameters<typeof request>[0]): Promise<string> {
  const response = await request(app)
    .post("/auth/login")
    .send({
      email: "owner@example.com",
      password: validTestCredential(),
    })
    .expect(200);

  return String(response.body.data.accessToken);
}
