import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type VaultSecretMetadata = {
  readonly id: string;
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly version: number;
  readonly status: "active" | "deleted";
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RevealedVaultSecret = VaultSecretMetadata & {
  readonly value: string;
};

export type VaultToken = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly tokenPrefix: string;
  readonly scopes: string[];
  readonly environments: string[];
  readonly status: "active" | "revoked";
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedVaultToken = {
  readonly token: VaultToken;
  readonly rawToken: string;
};

export type VaultAuditEvent = {
  readonly id: string;
  readonly messageId: string;
  readonly projectId: string;
  readonly actorType: "user" | "integration" | "service";
  readonly actorId: string;
  readonly action: string;
  readonly result: "success" | "failure";
  readonly environment: string | null;
  readonly secretKey: string | null;
  readonly tokenPrefix: string | null;
  readonly reason: string | null;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function createSecret(input: {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly value: string;
}): Promise<VaultSecretMetadata> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly secret: VaultSecretMetadata }>
  >("/vault/secrets", input);
  return response.data.data.secret;
}

export async function listSecrets(
  projectId: string,
  environment?: string,
): Promise<VaultSecretMetadata[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly secrets: VaultSecretMetadata[] }>
  >("/vault/secrets", { params: { projectId, environment } });
  return response.data.data.secrets;
}

export async function revealSecret(
  projectId: string,
  environment: string,
  key: string,
  vaultPassword: string,
): Promise<RevealedVaultSecret> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly secret: RevealedVaultSecret }>
  >(`/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/reveal`, {
    projectId,
    vaultPassword,
  });
  return response.data.data.secret;
}

export async function updateSecret(input: {
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly value: string;
}): Promise<VaultSecretMetadata> {
  const response = await apiClient.put<
    ApiSuccessResponse<{ readonly secret: VaultSecretMetadata }>
  >(`/vault/secrets/${encodeURIComponent(input.environment)}/${encodeURIComponent(input.key)}`, {
    projectId: input.projectId,
    value: input.value,
  });
  return response.data.data.secret;
}

export async function deleteSecret(
  projectId: string,
  environment: string,
  key: string,
): Promise<VaultSecretMetadata> {
  const response = await apiClient.delete<
    ApiSuccessResponse<{ readonly secret: VaultSecretMetadata }>
  >(`/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}`, {
    params: { projectId },
  });
  return response.data.data.secret;
}

export async function listVaultActivity(projectId: string): Promise<VaultSecretMetadata[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly vaultActivity: VaultSecretMetadata[] }>
  >("/dashboard/vault-activity", { params: { projectId } });
  return response.data.data.vaultActivity;
}

export async function listVaultAuditEvents(projectId: string): Promise<VaultAuditEvent[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly events: VaultAuditEvent[] }>>(
    "/audit/events",
    { params: { projectId } },
  );
  return response.data.data.events;
}

export async function createVaultToken(input: {
  readonly projectId: string;
  readonly name: string;
  readonly scopes?: string[];
  readonly environments?: string[];
  readonly expiresAt?: string | null;
}): Promise<CreatedVaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedVaultToken>>(
    "/vault/tokens",
    input,
  );
  return response.data.data;
}

export async function listVaultTokens(projectId: string): Promise<VaultToken[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly tokens: VaultToken[] }>>(
    "/vault/tokens",
    { params: { projectId } },
  );
  return response.data.data.tokens;
}

export async function revokeVaultToken(projectId: string, tokenId: string): Promise<VaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly token: VaultToken }>>(
    `/vault/tokens/${tokenId}/revoke`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.token;
}
