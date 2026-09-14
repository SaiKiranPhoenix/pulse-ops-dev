import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { VaultController } from "../../src/controllers/vault.controller.js";
import type { VaultService } from "../../src/services/vault.service.js";

describe("VaultController", () => {
  it("sets no-store headers on every endpoint that returns secret values", async () => {
    const vault = {
      reveal: vi.fn().mockResolvedValue({ id: "secret_1", value: "raw" }),
      fetchWithToken: vi.fn().mockResolvedValue({ id: "secret_1", value: "raw" }),
      fetchEnvironmentBundleWithToken: vi.fn().mockResolvedValue({
        projectId: "project_1",
        environment: "production",
        secrets: { API_TOKEN: "raw" },
        envFile: "API_TOKEN=raw",
        lease: { leaseId: "lease_1" },
        warnings: [],
      }),
    } as unknown as VaultService;
    const controller = new VaultController(vault);

    for (const createCall of [
      () => {
        const res = response({
          validatedBody: { projectId: "project_1", vaultPassword: "correct" },
          validatedParams: { environment: "production", key: "API_TOKEN" },
        });
        return {
          res,
          call: () => controller.reveal(request(), res),
        };
      },
      () => {
        const res = response({ validatedParams: { environment: "production", key: "API_TOKEN" } });
        return {
          res,
          call: () => controller.fetchWithToken(request({ "x-vault-token": "povt_token" }), res),
        };
      },
      () => {
        const res = response({ validatedParams: { environment: "production" } });
        return {
          res,
          call: () =>
            controller.fetchEnvironmentBundleWithToken(
              request({ "x-vault-token": "povt_token" }),
              res,
            ),
        };
      },
    ]) {
      const { call, res } = createCall();
      await call();
      expect(res.headers).toMatchObject({
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      });
    }
  });
});

function request(headers: Record<string, string> = {}): Request {
  return {
    header(name: string): string | undefined {
      return headers[name.toLowerCase()] ?? headers[name];
    },
  } as Request;
}

function response(locals: Record<string, unknown> = {}) {
  const res = {
    headers: {} as Record<string, string>,
    locals: { requestId: "request_1", auth: { userId: "user_1" }, ...locals },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status() {
      return this;
    },
    json() {
      return this;
    },
  };

  return res as unknown as Response & { readonly headers: Record<string, string> };
}
