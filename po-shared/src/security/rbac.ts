export const organizationRoles = ["owner", "admin", "developer", "viewer"] as const;
export const projectPermissions = ["read", "write", "admin"] as const;
export const protectedEnvironments = ["development", "staging", "production"] as const;

export type OrganizationRole = (typeof organizationRoles)[number];
export type ProjectPermission = (typeof projectPermissions)[number];
export type ProtectedEnvironment = (typeof protectedEnvironments)[number];

export type AccessDecisionInput = {
  readonly organizationRole: OrganizationRole;
  readonly projectPermission?: ProjectPermission | null;
  readonly environment?: string | null;
  readonly action: "read" | "write" | "admin" | "manage_members" | "reveal_secret";
};

const roleRank: Record<OrganizationRole, number> = {
  viewer: 1,
  developer: 2,
  admin: 3,
  owner: 4,
};

const projectPermissionRank: Record<ProjectPermission, number> = {
  read: 1,
  write: 2,
  admin: 3,
};

export function isOrganizationRole(value: string): value is OrganizationRole {
  return organizationRoles.some((role) => role === value);
}

export function canManageMembers(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageProductionAccess(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

export function canAccessProject(input: AccessDecisionInput): boolean {
  if (input.action === "manage_members") {
    return canManageMembers(input.organizationRole);
  }

  const requiredRank = requiredProjectRank(input.action);
  const effectiveRank = Math.max(
    roleRank[input.organizationRole],
    input.projectPermission === null || input.projectPermission === undefined
      ? 0
      : projectPermissionRank[input.projectPermission],
  );

  if (effectiveRank < requiredRank) {
    return false;
  }

  if (
    input.environment === "production" &&
    (input.action === "write" || input.action === "reveal_secret") &&
    !canManageProductionAccess(input.organizationRole)
  ) {
    return false;
  }

  return true;
}

function requiredProjectRank(action: AccessDecisionInput["action"]): number {
  if (action === "admin" || action === "reveal_secret") {
    return projectPermissionRank.admin;
  }

  if (action === "write") {
    return projectPermissionRank.write;
  }

  return projectPermissionRank.read;
}
