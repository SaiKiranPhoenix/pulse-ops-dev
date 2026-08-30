import { z } from "zod";
import { API_KEY_LIMITS, PROJECT_LIMITS } from "../config/constants.js";

const organizationRoles = ["owner", "admin", "developer", "viewer"] as const;
const projectPermissions = ["read", "write", "admin"] as const;
const protectedEnvironments = ["development", "staging", "production"] as const;

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid resource id");

export const projectParamsSchema = z.object({
  projectId: objectIdSchema,
});

export const organizationParamsSchema = z.object({
  organizationId: objectIdSchema,
});

export const organizationMemberParamsSchema = z.object({
  organizationId: objectIdSchema,
  memberId: objectIdSchema,
});

export const organizationMemberProjectParamsSchema = z.object({
  organizationId: objectIdSchema,
  memberId: objectIdSchema,
  projectId: objectIdSchema,
});

export const organizationMemberEnvironmentParamsSchema = z.object({
  organizationId: objectIdSchema,
  memberId: objectIdSchema,
  environment: z.enum(protectedEnvironments),
});

export const personalAccessTokenParamsSchema = z.object({
  organizationId: objectIdSchema,
  tokenId: objectIdSchema,
});

export const apiKeyParamsSchema = z.object({
  projectId: objectIdSchema,
  apiKeyId: objectIdSchema,
});

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_LIMITS.nameMaxLength),
  description: z.string().trim().max(500).nullable().optional(),
  organizationId: objectIdSchema.nullable().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(PROJECT_LIMITS.slugMaxLength)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens")
    .optional(),
});

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(PROJECT_LIMITS.nameMaxLength),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(PROJECT_LIMITS.slugMaxLength)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens")
    .optional(),
});

export const inviteMemberBodySchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().max(100).nullable().optional(),
  role: z.enum(organizationRoles),
});

export const updateMemberRoleBodySchema = z.object({
  role: z.enum(organizationRoles),
});

export const setProjectRoleBodySchema = z.object({
  permission: z.enum(projectPermissions).nullable(),
});

export const setEnvironmentPermissionBodySchema = z.object({
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canRevealSecrets: z.boolean(),
});

export const createPersonalAccessTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(API_KEY_LIMITS.nameMaxLength),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  expiresAt: z.coerce.date().min(new Date()).nullable().optional(),
});

export const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(API_KEY_LIMITS.nameMaxLength),
  scopes: z
    .array(z.enum(API_KEY_LIMITS.defaultScopes))
    .max(API_KEY_LIMITS.defaultScopes.length)
    .optional(),
  expiresAt: z.coerce.date().min(new Date()).nullable().optional(),
});

export type ProjectParams = z.infer<typeof projectParamsSchema>;
export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
export type OrganizationMemberParams = z.infer<typeof organizationMemberParamsSchema>;
export type OrganizationMemberProjectParams = z.infer<typeof organizationMemberProjectParamsSchema>;
export type OrganizationMemberEnvironmentParams = z.infer<
  typeof organizationMemberEnvironmentParamsSchema
>;
export type PersonalAccessTokenParams = z.infer<typeof personalAccessTokenParamsSchema>;
export type ApiKeyParams = z.infer<typeof apiKeyParamsSchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleBodySchema>;
export type SetProjectRoleBody = z.infer<typeof setProjectRoleBodySchema>;
export type SetEnvironmentPermissionBody = z.infer<typeof setEnvironmentPermissionBodySchema>;
export type CreatePersonalAccessTokenBody = z.infer<typeof createPersonalAccessTokenBodySchema>;
export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
