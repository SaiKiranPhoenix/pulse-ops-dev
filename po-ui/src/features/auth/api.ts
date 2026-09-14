import { apiClient, setAccessToken } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type CurrentUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: string;
};

export type RegisterInput = {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

export type OAuthProvider = "google" | "github";

export type AuthSession = {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly user: CurrentUser;
};

export type Project = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: "active" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ApiKey = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scopes: string[];
  readonly status: "active" | "disabled";
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedApiKey = {
  readonly apiKey: ApiKey;
  readonly rawKey: string;
};

export async function register(input: RegisterInput): Promise<AuthSession> {
  const response = await apiClient.post<ApiSuccessResponse<AuthSession>>("/auth/register", input);
  setAccessToken(response.data.data.accessToken);
  return response.data.data;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await apiClient.post<ApiSuccessResponse<AuthSession>>("/auth/login", input);
  setAccessToken(response.data.data.accessToken);
  return response.data.data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response =
    await apiClient.get<ApiSuccessResponse<{ readonly user: CurrentUser }>>("/auth/me");
  return response.data.data.user;
}

export async function updateCurrentUser(input: {
  readonly name: string | null;
}): Promise<CurrentUser> {
  const response = await apiClient.patch<ApiSuccessResponse<{ readonly user: CurrentUser }>>(
    "/auth/me",
    input,
  );
  return response.data.data.user;
}

export function getOAuthStartUrl(provider: OAuthProvider): string {
  return `${getApiBaseUrl()}/auth/oauth/${provider}/start`;
}

export function getApiBaseUrl(): string {
  return String(apiClient.defaults.baseURL ?? "");
}

export async function checkApiGatewayHealth(): Promise<boolean> {
  try {
    await apiClient.get("/health", { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export async function createProject(input: {
  readonly name: string;
  readonly description?: string | null;
  readonly slug?: string;
}): Promise<Project> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly project: Project }>>(
    "/projects",
    input,
  );
  return response.data.data.project;
}

export async function archiveProject(projectId: string): Promise<Project> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly project: Project }>>(
    `/projects/${projectId}/archive`,
  );
  return response.data.data.project;
}

export async function restoreProject(projectId: string): Promise<Project> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly project: Project }>>(
    `/projects/${projectId}/restore`,
  );
  return response.data.data.project;
}

export async function listProjects(): Promise<Project[]> {
  const response =
    await apiClient.get<ApiSuccessResponse<{ readonly projects: Project[] }>>("/projects");
  return response.data.data.projects;
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly project: Project }>>(
    `/projects/${projectId}`,
  );
  return response.data.data.project;
}

export async function createApiKey(
  projectId: string,
  input: {
    readonly name: string;
    readonly scopes?: string[];
    readonly expiresAt?: string | null;
  },
): Promise<CreatedApiKey> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedApiKey>>(
    `/projects/${projectId}/api-keys`,
    input,
  );
  return response.data.data;
}

export async function listApiKeys(projectId: string): Promise<ApiKey[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly apiKeys: ApiKey[] }>>(
    `/projects/${projectId}/api-keys`,
  );
  return response.data.data.apiKeys;
}

export async function rotateApiKey(projectId: string, apiKeyId: string): Promise<CreatedApiKey> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedApiKey>>(
    `/projects/${projectId}/api-keys/${apiKeyId}/rotate`,
  );
  return response.data.data;
}

export async function disableApiKey(projectId: string, apiKeyId: string): Promise<ApiKey> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly apiKey: ApiKey }>>(
    `/projects/${projectId}/api-keys/${apiKeyId}/disable`,
  );
  return response.data.data.apiKey;
}

export type OrganizationRole = "owner" | "admin" | "developer" | "viewer";
export type ProjectPermission = "read" | "write" | "admin";
export type ProtectedEnvironment = "development" | "staging" | "production";
export type OrganizationMemberStatus = "active" | "invited" | "removed";

export type ProjectRoleOverride = {
  readonly projectId: string;
  readonly permission: ProjectPermission;
};

export type EnvironmentPermission = {
  readonly environment: ProtectedEnvironment;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canRevealSecrets: boolean;
};

export type Organization = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: OrganizationRole;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type OrganizationMember = {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: OrganizationRole;
  readonly status: OrganizationMemberStatus;
  readonly projectRoles: readonly ProjectRoleOverride[];
  readonly environmentPermissions: readonly EnvironmentPermission[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PersonalAccessToken = {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: readonly string[];
  readonly status: "active" | "revoked";
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
};

export type CreatedPersonalAccessToken = {
  readonly token: PersonalAccessToken;
  readonly rawToken: string;
};

export async function listOrganizations(): Promise<Organization[]> {
  const response =
    await apiClient.get<ApiSuccessResponse<{ readonly organizations: Organization[] }>>(
      "/organizations",
    );
  return response.data.data.organizations;
}

export async function createOrganization(input: {
  readonly name: string;
  readonly slug?: string;
}): Promise<Organization> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly organization: Organization }>
  >("/organizations", input);
  return response.data.data.organization;
}

export async function listOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMember[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly members: OrganizationMember[] }>
  >(`/organizations/${organizationId}/members`);
  return response.data.data.members;
}

export async function inviteOrganizationMember(
  organizationId: string,
  input: {
    readonly email: string;
    readonly role: OrganizationRole;
    readonly displayName?: string | null;
  },
): Promise<OrganizationMember> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly member: OrganizationMember }>
  >(`/organizations/${organizationId}/invitations`, input);
  return response.data.data.member;
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  role: OrganizationRole,
): Promise<OrganizationMember> {
  const response = await apiClient.patch<
    ApiSuccessResponse<{ readonly member: OrganizationMember }>
  >(`/organizations/${organizationId}/members/${memberId}/role`, { role });
  return response.data.data.member;
}

export async function setOrganizationMemberProjectRole(
  organizationId: string,
  memberId: string,
  projectId: string,
  permission: ProjectPermission | null,
): Promise<OrganizationMember> {
  const response = await apiClient.put<ApiSuccessResponse<{ readonly member: OrganizationMember }>>(
    `/organizations/${organizationId}/members/${memberId}/project-roles/${projectId}`,
    {
      permission,
    },
  );
  return response.data.data.member;
}

export async function setOrganizationMemberEnvironmentPermission(
  organizationId: string,
  memberId: string,
  environment: ProtectedEnvironment,
  permissions: {
    readonly canRead: boolean;
    readonly canWrite: boolean;
    readonly canRevealSecrets: boolean;
  },
): Promise<OrganizationMember> {
  const response = await apiClient.put<ApiSuccessResponse<{ readonly member: OrganizationMember }>>(
    `/organizations/${organizationId}/members/${memberId}/environment-permissions/${environment}`,
    permissions,
  );
  return response.data.data.member;
}

export async function removeOrganizationMember(
  organizationId: string,
  memberId: string,
): Promise<OrganizationMember> {
  const response = await apiClient.delete<
    ApiSuccessResponse<{ readonly member: OrganizationMember }>
  >(`/organizations/${organizationId}/members/${memberId}`);
  return response.data.data.member;
}

export async function listPersonalAccessTokens(
  organizationId: string,
): Promise<PersonalAccessToken[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly tokens: PersonalAccessToken[] }>
  >(`/organizations/${organizationId}/personal-access-tokens`);
  return response.data.data.tokens;
}

export async function createPersonalAccessToken(
  organizationId: string,
  input: {
    readonly name: string;
    readonly scopes?: readonly string[];
    readonly expiresAt?: string | null;
  },
): Promise<CreatedPersonalAccessToken> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedPersonalAccessToken>>(
    `/organizations/${organizationId}/personal-access-tokens`,
    input,
  );
  return response.data.data;
}

export async function revokePersonalAccessToken(
  organizationId: string,
  tokenId: string,
): Promise<PersonalAccessToken> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly token: PersonalAccessToken }>
  >(`/organizations/${organizationId}/personal-access-tokens/${tokenId}/revoke`);
  return response.data.data.token;
}
