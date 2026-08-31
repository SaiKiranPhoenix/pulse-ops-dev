import { apiClient } from "@/lib/api-client";

export type VaultCapability =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "list"
  | "deny"
  | "sudo";

export interface VaultPolicyRule {
  path: string;
  capabilities: VaultCapability[];
  description?: string;
}

export interface VaultPolicyHistoryItem {
  version: number;
  rules: VaultPolicyRule[];
  modifiedBy: string;
  modifiedAt: string;
}

export interface VaultPolicy {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  rules: VaultPolicyRule[];
  version: number;
  isDefault: boolean;
  history?: VaultPolicyHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicySimulationInput {
  projectId: string;
  path: string;
  capability: VaultCapability;
  policyIds?: string[];
  environment?: string;
  userRole?: string;
}

export interface PolicySimulationResult {
  allowed: boolean;
  matchedPolicyName?: string;
  matchedRule?: VaultPolicyRule;
  reason: string;
  safeExplanation: string;
  requiresProductionConfirmation?: boolean;
}

export interface SecretMetadataConfig {
  maxVersions?: number;
  casRequired?: boolean;
  deleteProtection?: boolean;
  customMetadata?: Record<string, string>;
  expiresAt?: string;
  ttlSeconds?: number;
  rotationPeriodDays?: number;
  nextRotationDate?: string;
  autoRotateEnabled?: boolean;
}

export interface DynamicDatabaseCredential {
  leaseId: string;
  projectId: string;
  engine: "postgres" | "mysql" | "mongodb";
  username: string;
  password: string;
  ttlSeconds: number;
  expiresAt: string;
  renewable: boolean;
  createdAt: string;
}

export interface TransitEncryptionResult {
  keyName: string;
  ciphertext: string;
  keyVersion: number;
}

export interface TransitDecryptionResult {
  keyName: string;
  plaintext: string;
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

// --- POLICIES API ---
export async function listVaultPolicies(projectId: string): Promise<VaultPolicy[]> {
  const res = await apiClient.get<ApiResponse<{ policies: VaultPolicy[] }>>(
    `/vault/policies?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.policies;
}

export async function createVaultPolicy(
  projectId: string,
  input: { name: string; description?: string; rules: VaultPolicyRule[]; isDefault?: boolean },
): Promise<VaultPolicy> {
  const res = await apiClient.post<ApiResponse<{ policy: VaultPolicy }>>(
    `/vault/policies?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.policy;
}

export async function updateVaultPolicy(
  projectId: string,
  policyId: string,
  input: { name?: string; description?: string; rules?: VaultPolicyRule[]; isDefault?: boolean },
): Promise<VaultPolicy> {
  const res = await apiClient.put<ApiResponse<{ policy: VaultPolicy }>>(
    `/vault/policies/${encodeURIComponent(policyId)}?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.policy;
}

export async function deleteVaultPolicy(projectId: string, policyId: string): Promise<boolean> {
  const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
    `/vault/policies/${encodeURIComponent(policyId)}?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.deleted;
}

export async function simulateVaultPolicy(
  projectId: string,
  input: Omit<PolicySimulationInput, "projectId">,
): Promise<PolicySimulationResult> {
  const res = await apiClient.post<ApiResponse<{ result: PolicySimulationResult }>>(
    `/vault/policies/simulate?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.result;
}

// --- DYNAMIC DATABASE SECRETS API ---
export async function generateDynamicDbCredential(
  projectId: string,
  input: { engine: "postgres" | "mysql" | "mongodb"; role?: string; ttlSeconds?: number },
): Promise<DynamicDatabaseCredential> {
  const res = await apiClient.post<ApiResponse<{ credential: DynamicDatabaseCredential }>>(
    `/vault/dynamic/database/creds?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.credential;
}

export async function listDynamicDbCredentials(projectId: string): Promise<DynamicDatabaseCredential[]> {
  const res = await apiClient.get<ApiResponse<{ leases: DynamicDatabaseCredential[] }>>(
    `/vault/dynamic/database/creds?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.leases;
}

export async function renewDynamicDbLease(
  projectId: string,
  leaseId: string,
  incrementSeconds = 3600,
): Promise<DynamicDatabaseCredential> {
  const res = await apiClient.post<ApiResponse<{ lease: DynamicDatabaseCredential }>>(
    `/vault/dynamic/database/creds/${encodeURIComponent(leaseId)}/renew?projectId=${encodeURIComponent(projectId)}`,
    { incrementSeconds },
  );
  return res.data.data.lease;
}

export async function revokeDynamicDbLease(projectId: string, leaseId: string): Promise<boolean> {
  const res = await apiClient.post<ApiResponse<{ revoked: boolean }>>(
    `/vault/dynamic/database/creds/${encodeURIComponent(leaseId)}/revoke?projectId=${encodeURIComponent(projectId)}`,
    {},
  );
  return res.data.data.revoked;
}

// --- TRANSIT ENCRYPTION API ---
export async function transitEncrypt(
  projectId: string,
  input: { keyName: string; plaintext: string },
): Promise<TransitEncryptionResult> {
  const res = await apiClient.post<ApiResponse<TransitEncryptionResult>>(
    `/vault/transit/encrypt?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data;
}

export async function transitDecrypt(
  projectId: string,
  input: { keyName: string; ciphertext: string },
): Promise<TransitDecryptionResult> {
  const res = await apiClient.post<ApiResponse<TransitDecryptionResult>>(
    `/vault/transit/decrypt?projectId=${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data;
}

export async function rotateTransitKey(
  projectId: string,
  keyName: string,
): Promise<{ keyName: string; newVersion: number }> {
  const res = await apiClient.post<ApiResponse<{ keyName: string; newVersion: number }>>(
    `/vault/transit/keys/${encodeURIComponent(keyName)}/rotate?projectId=${encodeURIComponent(projectId)}`,
    {},
  );
  return res.data.data;
}

// --- KV v2 METADATA & VERSION LIFECYCLE API ---
export async function updateSecretMetadata(
  projectId: string,
  environment: string,
  key: string,
  metadata: SecretMetadataConfig,
): Promise<SecretMetadataConfig> {
  const res = await apiClient.patch<ApiResponse<{ metadata: SecretMetadataConfig }>>(
    `/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/metadata?projectId=${encodeURIComponent(projectId)}`,
    metadata,
  );
  return res.data.data.metadata;
}

export async function softDeleteSecretVersion(
  projectId: string,
  environment: string,
  key: string,
  version: number,
): Promise<unknown> {
  const res = await apiClient.post<ApiResponse<{ version: unknown }>>(
    `/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/versions/${version}/soft-delete?projectId=${encodeURIComponent(projectId)}`,
    {},
  );
  return res.data.data.version;
}

export async function undeleteSecretVersion(
  projectId: string,
  environment: string,
  key: string,
  version: number,
): Promise<unknown> {
  const res = await apiClient.post<ApiResponse<{ version: unknown }>>(
    `/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/versions/${version}/undelete?projectId=${encodeURIComponent(projectId)}`,
    {},
  );
  return res.data.data.version;
}

export async function destroySecretVersion(
  projectId: string,
  environment: string,
  key: string,
  version: number,
): Promise<unknown> {
  const res = await apiClient.delete<ApiResponse<{ version: unknown }>>(
    `/vault/secrets/${encodeURIComponent(environment)}/${encodeURIComponent(key)}/versions/${version}/destroy?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data.data.version;
}
