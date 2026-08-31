import { describe, expect, it } from "vitest";
import { PolicyEvaluationEngine } from "../../src/services/policy-evaluation.engine.js";
import type { VaultPolicy } from "@pulseops/shared/types";

describe("PolicyEvaluationEngine", () => {
  const engine = new PolicyEvaluationEngine();

  const mockPolicies: VaultPolicy[] = [
    {
      id: "pol_dev",
      projectId: "p1",
      name: "developer-policy",
      rules: [
        { path: "secret/data/development/*", capabilities: ["read", "list", "create", "update"] },
        { path: "secret/data/production/*", capabilities: ["deny"] },
        { path: "transit/encrypt/app-key", capabilities: ["update"] },
      ],
      version: 1,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "pol_admin",
      projectId: "p1",
      name: "admin-policy",
      rules: [
        { path: "secret/data/production/*", capabilities: ["read", "update", "delete", "sudo"] },
      ],
      version: 1,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("grants access when path and capability match", () => {
    const result = engine.evaluate("secret/data/development/db_password", "read", [mockPolicies[0]!]);
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicyName).toBe("developer-policy");
  });

  it("denies access by default when no matching rule is found", () => {
    const result = engine.evaluate("database/creds/mysql", "read", [mockPolicies[0]!]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Deny by default");
  });

  it("enforces explicit deny precedence over grant rules", () => {
    // Both dev policy (deny production) and admin policy (grant production)
    const result = engine.evaluate("secret/data/production/api_key", "read", mockPolicies);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Explicit deny rule matched");
  });

  it("flags production destructive actions for extra confirmation", () => {
    const result = engine.evaluate("secret/data/production/api_key", "delete", [mockPolicies[1]!], {
      environment: "production",
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresProductionConfirmation).toBe(true);
  });
});
