export type VaultCapability = "create" | "read" | "update" | "delete" | "list" | "deny" | "sudo";

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

export interface SecretVersionV2 {
  version: number;
  createdAt: string;
  createdBy: string | null;
  deleted: boolean;
  destroyed: boolean;
  destroyedAt?: string | null;
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
