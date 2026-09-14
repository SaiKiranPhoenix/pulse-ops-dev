import { describe, expect, it } from "vitest";
import { canAccessProject, canManageMembers } from "../../src/security/index.js";

describe("rbac helpers", () => {
  it("allows organization viewers to read but not write", () => {
    expect(canAccessProject({ organizationRole: "viewer", action: "read" })).toBe(true);
    expect(canAccessProject({ organizationRole: "viewer", action: "write" })).toBe(false);
  });

  it("blocks developer writes to production unless elevated by organization role", () => {
    expect(
      canAccessProject({
        organizationRole: "developer",
        action: "write",
        environment: "production",
      }),
    ).toBe(false);
    expect(
      canAccessProject({
        organizationRole: "admin",
        action: "write",
        environment: "production",
      }),
    ).toBe(true);
  });

  it("supports project-level permission overrides for scoped access", () => {
    expect(
      canAccessProject({
        organizationRole: "viewer",
        projectPermission: "write",
        action: "write",
        environment: "staging",
      }),
    ).toBe(true);
  });

  it("keeps member management owner and admin only", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("developer")).toBe(false);
  });
});
