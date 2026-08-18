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

export async function register(input: RegisterInput): Promise<CurrentUser> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly user: CurrentUser }>>(
    "/auth/register",
    input,
  );
  return response.data.data.user;
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

export function getOAuthStartUrl(provider: OAuthProvider): string {
  return `${apiClient.defaults.baseURL ?? ""}/auth/oauth/${provider}/start`;
}

export async function createProject(input: {
  readonly name: string;
  readonly slug?: string;
}): Promise<Project> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly project: Project }>>(
    "/projects",
    input,
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
