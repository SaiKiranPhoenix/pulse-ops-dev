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
): Promise<RevealedVaultSecret> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly secret: RevealedVaultSecret }>
  >(`/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/reveal`, {
    params: { projectId },
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
