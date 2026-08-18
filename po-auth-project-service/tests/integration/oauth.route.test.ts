import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createTestDependencies,
  registeredUser,
  validTestCredential,
} from "../support/test-dependencies.js";

describe("OAuth routes", () => {
  it("redirects to the selected provider with signed state and callback URL", async () => {
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

    const response = await request(app).get("/auth/oauth/github/start").expect(302);
    const location = response.headers.location;

    expect(location).toBe(
      "https://github.example.test/oauth?redirect_uri=http%3A%2F%2Flocalhost%3A4000%2Fauth%2Foauth%2Fgithub%2Fcallback&state=test-oauth-state%3Agithub",
    );
  });

  it("creates an OAuth-only user and redirects with the session token in the URL fragment", async () => {
    const harness = createTestDependencies();
    const app = createApp({ dependencies: harness.dependencies });

    const response = await request(app)
      .get("/auth/oauth/github/callback")
      .query({
        code: "provider_code",
        state: "test-oauth-state:github",
      })
      .expect(302);
    const location = new URL(String(response.headers.location));

    expect(location.origin + location.pathname).toBe("http://localhost:3000/oauth/callback");
    expect(location.hash).toContain("access_token=");
    expect(location.hash).toContain("token_type=Bearer");
    expect(harness.users.createdOAuthInputs).toEqual([
      {
        email: "github@example.com",
        name: "Git Hub",
        oauthAccount: {
          provider: "github",
          providerUserId: "123",
        },
      },
    ]);
  });

  it("links OAuth sign-in to an existing verified email without changing password login", async () => {
    const harness = createTestDependencies();
    harness.users.seed(
      registeredUser({
        email: "github@example.com",
        name: "Existing User",
      }),
    );
    const app = createApp({ dependencies: harness.dependencies });

    await request(app)
      .get("/auth/oauth/github/callback")
      .query({
        code: "provider_code",
        state: "test-oauth-state:github",
      })
      .expect(302);

    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "github@example.com",
        password: validTestCredential(),
      })
      .expect(200);

    expect(loginResponse.body.data.user.name).toBe("Existing User");
    expect(harness.users.createdOAuthInputs).toEqual([]);
  });
});
