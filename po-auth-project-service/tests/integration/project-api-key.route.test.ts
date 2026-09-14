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
        description: "Revenue path telemetry",
      })
      .expect(201);

    expect(projectResponse.body.data.project).toMatchObject({
      id: "000000000000000000000014",
      name: "Checkout API",
      slug: "checkout-api",
      description: "Revenue path telemetry",
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
    expect(JSON.stringify(apiKeyResponse.body)).not.toContain("keyHash");

    const [createdReadModel] = [...harness.ingestionApiKeys.records.values()];
    expect(createdReadModel).toMatchObject({
      projectId: "000000000000000000000014",
      ownerId: "000000000000000000000001",
      keyPrefix: apiKeyResponse.body.data.apiKey.keyPrefix,
      scopes: ["errors:write", "logs:write", "metrics:write"],
      status: "active",
    });

    const listKeysResponse = await request(app)
      .get("/projects/000000000000000000000014/api-keys")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_list_keys")
      .expect(200);

    expect(JSON.stringify(listKeysResponse.body)).not.toContain(
      String(apiKeyResponse.body.data.rawKey),
    );
    expect(listKeysResponse.body.data.apiKeys).toHaveLength(1);

    const rotateResponse = await request(app)
      .post("/projects/000000000000000000000014/api-keys/000000000000000000000028/rotate")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_rotate_key")
      .expect(200);

    expect(rotateResponse.body.data.apiKey).toMatchObject({
      id: "000000000000000000000029",
      projectId: "000000000000000000000014",
      name: "Local ingestion rotated",
      status: "active",
    });
    expect(rotateResponse.body.data.rawKey).toMatch(/^po_live_/);

    const readModelsAfterRotate = [...harness.ingestionApiKeys.records.values()];
    expect(readModelsAfterRotate).toHaveLength(2);
    expect(readModelsAfterRotate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyPrefix: apiKeyResponse.body.data.apiKey.keyPrefix,
          status: "disabled",
        }),
        expect.objectContaining({
          keyPrefix: rotateResponse.body.data.apiKey.keyPrefix,
          status: "active",
        }),
      ]),
    );
    expect(harness.apiKeyCacheInvalidator.invalidatedKeyHashes).toHaveLength(1);

    await request(app)
      .post("/projects/000000000000000000000014/api-keys/000000000000000000000029/disable")
      .set("authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req_disable_key")
      .expect(200);

    expect([...harness.ingestionApiKeys.records.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyPrefix: rotateResponse.body.data.apiKey.keyPrefix,
          status: "disabled",
        }),
      ]),
    );
    expect(harness.apiKeyCacheInvalidator.invalidatedKeyHashes).toHaveLength(2);
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

  it("enforces project ownership across detail, archive, restore, and API key routes", async () => {
    const harness = createTestDependencies();
    harness.users.seed(registeredUser({ email: "owner@example.com", name: "Owner" }));
    harness.users.seed(
      registeredUser({
        id: "000000000000000000000002",
        email: "other@example.com",
        name: "Other",
      }),
    );
    const app = createApp({ dependencies: harness.dependencies });
    const ownerToken = await login(app, "owner@example.com");
    const otherToken = await login(app, "other@example.com");

    await request(app)
      .post("/projects")
      .set("authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owned API" })
      .expect(201);

    await request(app)
      .get("/projects/000000000000000000000014")
      .set("authorization", `Bearer ${otherToken}`)
      .expect(404);

    await request(app)
      .post("/projects/000000000000000000000014/api-keys")
      .set("authorization", `Bearer ${otherToken}`)
      .send({ name: "bad key" })
      .expect(404);

    const archiveResponse = await request(app)
      .post("/projects/000000000000000000000014/archive")
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(archiveResponse.body.data.project).toMatchObject({
      id: "000000000000000000000014",
      status: "archived",
    });

    await request(app)
      .post("/projects/000000000000000000000014/restore")
      .set("authorization", `Bearer ${otherToken}`)
      .expect(404);

    const restoreResponse = await request(app)
      .post("/projects/000000000000000000000014/restore")
      .set("authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(restoreResponse.body.data.project).toMatchObject({
      id: "000000000000000000000014",
      status: "active",
    });
  });
});

async function login(
  app: Parameters<typeof request>[0],
  email = "owner@example.com",
): Promise<string> {
  const response = await request(app)
    .post("/auth/login")
    .send({
      email,
      password: validTestCredential(),
    })
    .expect(200);

  return String(response.body.data.accessToken);
}
