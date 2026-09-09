import { apiClient } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";

export type VaultSecretMetadata = {
  readonly id: string;
  readonly projectId: string;
  readonly environment: string;
  readonly key: string;
  readonly version: number;
  readonly status: "active" | "deleted";
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultLease = {
  readonly id: string;
  readonly leaseId: string;
  readonly projectId: string;
  readonly environment: string;
  readonly tokenId: string;
  readonly tokenPrefix: string;
  readonly identityAlias: string;
  readonly secretKeys: string[];
  readonly status: "active" | "revoked" | "expired";
  readonly ttlSeconds: number;
  readonly renewable: boolean;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly renewedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokeReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultSecretConsumer = {
  readonly id: string;
  readonly projectId: string;
  readonly environment: string;
  readonly secretKey: string;
  readonly tokenId: string;
  readonly tokenPrefix: string;
  readonly identityAlias: string;
  readonly fetchCount: number;
  readonly lastFetchedAt: string;
  readonly lastLeaseId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultSecretRotation = {
  readonly environment: string;
  readonly key: string;
  readonly version: number;
  readonly rotationPeriodDays: number | null;
  readonly autoRotateEnabled: boolean;
  readonly nextRotationDate: string | null;
  readonly due: boolean;
  readonly lastRotatedAt: string;
};

export type VaultEnvironmentBundle = {
  readonly projectId: string;
  readonly environment: string;
  readonly secrets: Record<string, string>;
  readonly envFile: string;
  readonly lease: VaultLease;
  readonly warnings: string[];
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
  readonly authMethod: "integration-token" | "service-account" | "approle";
  readonly identityAlias: string;
  readonly parentTokenId: string | null;
  readonly ttlSeconds: number;
  readonly maxTtlSeconds: number;
  readonly renewable: boolean;
  readonly issuedAt: string;
  readonly renewedAt: string | null;
  readonly status: "active" | "revoked";
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultAuthMethod = {
  readonly id: string;
  readonly projectId: string;
  readonly type: "service-account" | "approle";
  readonly name: string;
  readonly identityAlias: string;
  readonly roleId: string | null;
  readonly tokenScopes: string[];
  readonly tokenEnvironments: string[];
  readonly tokenTtlSeconds: number;
  readonly tokenMaxTtlSeconds: number;
  readonly renewable: boolean;
  readonly status: "active" | "disabled";
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreatedVaultAuthMethod = {
  readonly authMethod: VaultAuthMethod;
  readonly secretId: string | null;
  readonly rawToken: string | null;
};

export type VaultIdentity = {
  readonly id: string;
  readonly projectId: string;
  readonly alias: string;
  readonly type: "user" | "oauth" | "service-account" | "approle";
  readonly displayName: string;
  readonly metadata: Record<string, string>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VaultTokenCacheDiagnostics = {
  readonly projectId: string;
  readonly status: "disabled";
  readonly validationMode: "database";
  readonly cachedTokens: 0;
  readonly cacheKeyPrefix: null;
  readonly inspectedAt: string;
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

export type VaultAuditComplianceReport = {
  readonly backend: {
    readonly name: string;
    readonly capabilities: {
      readonly durable: boolean;
      readonly export: boolean;
      readonly integrityCheck: boolean;
      readonly retentionDays: number | null;
    };
    readonly planned: readonly {
      readonly name: string;
      readonly status: string;
      readonly purpose: string;
    }[];
  };
  readonly generatedAt: string;
  readonly totals: {
    readonly events: number;
    readonly successes: number;
    readonly failures: number;
    readonly failedReveals: number;
    readonly failedFetches: number;
  };
  readonly secretAccessByActor: readonly {
    readonly actor: string;
    readonly fetches: number;
    readonly reveals: number;
    readonly failures: number;
  }[];
};

export type VaultAuditIntegrity = {
  readonly backend: string;
  readonly checkedAt: string;
  readonly valid: boolean;
  readonly eventCount: number;
  readonly headHash: string;
};

export type VaultAuditFilters = {
  readonly action?: string;
  readonly result?: "success" | "failure";
  readonly environment?: string;
  readonly secretKey?: string;
  readonly actor?: string;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
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

export type VaultSecretVersion = {
  readonly version: number;
  readonly status: "rotated" | "deleted";
  readonly actorId: string | null;
  readonly occurredAt: string;
};

export async function listSecretVersions(
  projectId: string,
  environment: string,
  key: string,
): Promise<VaultSecretVersion[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly versions: VaultSecretVersion[] }>
  >(`/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/versions`, {
    params: { projectId },
  });
  return response.data.data.versions;
}

export async function listVaultAuditEvents(
  projectId: string,
  filters: VaultAuditFilters = {},
): Promise<VaultAuditEvent[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly events: VaultAuditEvent[] }>>(
    "/audit/events",
    { params: { projectId, ...filters } },
  );
  return response.data.data.events;
}

export async function createVaultToken(input: {
  readonly projectId: string;
  readonly name: string;
  readonly scopes?: string[];
  readonly environments?: string[];
  readonly expiresAt?: string | null;
  readonly ttlSeconds?: number;
  readonly maxTtlSeconds?: number;
  readonly renewable?: boolean;
}): Promise<CreatedVaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedVaultToken>>(
    "/vault/tokens",
    input,
  );
  return response.data.data;
}

export async function lookupVaultToken(rawToken: string): Promise<VaultToken> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly token: VaultToken }>>(
    "/vault/token/lookup-self",
    { headers: { "x-vault-token": rawToken } },
  );
  return response.data.data.token;
}

export async function renewVaultToken(rawToken: string): Promise<VaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly token: VaultToken }>>(
    "/vault/token/renew-self",
    undefined,
    { headers: { "x-vault-token": rawToken } },
  );
  return response.data.data.token;
}

export async function revokeVaultTokenSelf(rawToken: string): Promise<VaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly token: VaultToken }>>(
    "/vault/token/revoke-self",
    undefined,
    { headers: { "x-vault-token": rawToken } },
  );
  return response.data.data.token;
}

export async function createVaultAuthMethod(input: {
  readonly projectId: string;
  readonly type: "service-account" | "approle";
  readonly name: string;
  readonly scopes?: string[];
  readonly environments?: string[];
  readonly ttlSeconds?: number;
  readonly maxTtlSeconds?: number;
  readonly renewable?: boolean;
}): Promise<CreatedVaultAuthMethod> {
  const response = await apiClient.post<ApiSuccessResponse<CreatedVaultAuthMethod>>(
    "/vault/auth-methods",
    input,
  );
  return response.data.data;
}

export async function listVaultAuthMethods(projectId: string): Promise<VaultAuthMethod[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly authMethods: VaultAuthMethod[] }>
  >("/vault/auth-methods", { params: { projectId } });
  return response.data.data.authMethods;
}

export async function disableVaultAuthMethod(
  projectId: string,
  authMethodId: string,
): Promise<VaultAuthMethod> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ readonly authMethod: VaultAuthMethod }>
  >(`/vault/auth-methods/${authMethodId}/disable`, undefined, { params: { projectId } });
  return response.data.data.authMethod;
}

export async function listVaultIdentities(projectId: string): Promise<VaultIdentity[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly identities: VaultIdentity[] }>
  >("/vault/identities", { params: { projectId } });
  return response.data.data.identities;
}

export async function listVaultTokens(projectId: string): Promise<VaultToken[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly tokens: VaultToken[] }>>(
    "/vault/tokens",
    { params: { projectId } },
  );
  return response.data.data.tokens;
}

export async function getVaultTokenCacheDiagnostics(
  projectId: string,
): Promise<VaultTokenCacheDiagnostics> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly diagnostics: VaultTokenCacheDiagnostics }>
  >("/vault/token-cache/diagnostics", { params: { projectId } });
  return response.data.data.diagnostics;
}

export async function revokeVaultToken(projectId: string, tokenId: string): Promise<VaultToken> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly token: VaultToken }>>(
    `/vault/tokens/${tokenId}/revoke`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.token;
}

export async function fetchSecretWithIntegrationToken(
  environment: string,
  key: string,
  rawToken: string,
): Promise<RevealedVaultSecret> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly secret: RevealedVaultSecret }>
  >(`/integrations/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}`, {
    headers: { "x-vault-token": rawToken },
  });
  return response.data.data.secret;
}

export async function fetchEnvironmentBundleWithIntegrationToken(
  environment: string,
  rawToken: string,
): Promise<VaultEnvironmentBundle> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly bundle: VaultEnvironmentBundle }>
  >(`/integrations/vault/env/${encodeURIComponent(environment)}`, {
    headers: { "x-vault-token": rawToken },
  });
  return response.data.data.bundle;
}

export async function listVaultLeases(projectId: string): Promise<VaultLease[]> {
  const response = await apiClient.get<ApiSuccessResponse<{ readonly leases: VaultLease[] }>>(
    "/vault/leases",
    { params: { projectId } },
  );
  return response.data.data.leases;
}

export async function renewVaultLease(projectId: string, leaseId: string): Promise<VaultLease> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly lease: VaultLease }>>(
    `/vault/leases/${encodeURIComponent(leaseId)}/renew`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.lease;
}

export async function revokeVaultLease(projectId: string, leaseId: string): Promise<VaultLease> {
  const response = await apiClient.post<ApiSuccessResponse<{ readonly lease: VaultLease }>>(
    `/vault/leases/${encodeURIComponent(leaseId)}/revoke`,
    undefined,
    { params: { projectId } },
  );
  return response.data.data.lease;
}

export async function listVaultSecretConsumers(projectId: string): Promise<VaultSecretConsumer[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly consumers: VaultSecretConsumer[] }>
  >("/vault/secret-consumers", { params: { projectId } });
  return response.data.data.consumers;
}

export async function listVaultRotationSchedule(projectId: string): Promise<VaultSecretRotation[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly rotations: VaultSecretRotation[] }>
  >("/vault/rotation-schedule", { params: { projectId } });
  return response.data.data.rotations;
}

export async function exportVaultAuditEvents(
  projectId: string,
  filters: VaultAuditFilters = {},
): Promise<{
  readonly backend: string;
  readonly exportedAt: string;
  readonly events: VaultAuditEvent[];
}> {
  const response = await apiClient.get<
    ApiSuccessResponse<{
      readonly export: {
        readonly backend: string;
        readonly exportedAt: string;
        readonly events: VaultAuditEvent[];
      };
    }>
  >("/audit/events/export", { params: { projectId, ...filters } });
  return response.data.data.export;
}

export async function getVaultAuditComplianceReport(
  projectId: string,
): Promise<VaultAuditComplianceReport> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly report: VaultAuditComplianceReport }>
  >("/audit/compliance/report", { params: { projectId } });
  return response.data.data.report;
}

export async function checkVaultAuditIntegrity(projectId: string): Promise<VaultAuditIntegrity> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ readonly integrity: VaultAuditIntegrity }>
  >("/audit/compliance/integrity", { params: { projectId } });
  return response.data.data.integrity;
}
