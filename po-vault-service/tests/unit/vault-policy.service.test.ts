import { describe, expect, it } from "vitest";
import { VaultPolicyService } from "../../src/services/vault-policy.service.js";
import { DynamicSecretService } from "../../src/services/dynamic-secret.service.js";
import { TransitEngineService } from "../../src/services/transit-engine.service.js";

describe("VaultPolicyService & Secret Engines", () => {
  const policyService = new VaultPolicyService();
  const dynamicService = new DynamicSecretService();
  const transitService = new TransitEngineService();

  describe("VaultPolicyService", () => {
    it("lists default seeded policies", async () => {
      const policies = await policyService.listPolicies("p1");
      expect(policies.length).toBeGreaterThanOrEqual(2);
      expect(policies.some((p) => p.name === "admin-root-policy")).toBe(true);
    });

    it("creates, updates and deletes a custom policy", async () => {
      const created = await policyService.createPolicy("p1", {
        name: "test-policy",
        rules: [{ path: "secret/data/staging/*", capabilities: ["read", "list"] }],
      });
      expect(created.id).toBeDefined();
      expect(created.rules.length).toBe(1);

      const updated = await policyService.updatePolicy("p1", created.id, {
        description: "Updated description",
      });
      expect(updated?.description).toBe("Updated description");
      expect(updated?.version).toBe(2);

      const deleted = await policyService.deletePolicy("p1", created.id);
      expect(deleted).toBe(true);
    });

    it("simulates policy verification for path and capability", async () => {
      const result = await policyService.simulate({
        projectId: "p1",
        path: "secret/data/development/my-secret",
        capability: "read",
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("DynamicSecretService", () => {
    it("generates, lists, renews and revokes leased database credentials", async () => {
      const cred = await dynamicService.generateDbCredential("p1", "postgres", "readwrite", 1800);
      expect(cred.leaseId).toBeDefined();
      expect(cred.engine).toBe("postgres");
      expect(cred.username).toContain("v_postgres_readwrite");

      const leases = await dynamicService.listLeases("p1");
      expect(leases.some((l) => l.leaseId === cred.leaseId)).toBe(true);

      const renewed = await dynamicService.renewLease("p1", cred.leaseId, 3600);
      expect(renewed).not.toBeNull();

      const revoked = await dynamicService.revokeLease("p1", cred.leaseId);
      expect(revoked).toBe(true);
    });
  });

  describe("TransitEngineService", () => {
    it("encrypts and decrypts text using customer-managed cryptographic keys", async () => {
      const plaintext = "super-confidential-payload-2026";
      const enc = await transitService.encrypt("p1", "app-customer-key", plaintext);
      expect(enc.ciphertext).toMatch(/^vault:v1:/);

      const dec = await transitService.decrypt("p1", "app-customer-key", enc.ciphertext);
      expect(dec.plaintext).toBe(plaintext);

      const rotated = await transitService.rotateKey("p1", "app-customer-key");
      expect(rotated.newVersion).toBe(2);
    });
  });
});
