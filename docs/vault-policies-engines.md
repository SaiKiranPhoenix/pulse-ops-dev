# Vault Policies, Access Model & Secret Engines

PulseOps Vault provides zero-knowledge cryptographic secret management with granular Path-Based Access Control (RBAC), live policy simulation, dynamic leased credentials, and customer-managed transit cryptography.

## Architecture Overview

```
 [Application / User / CI Pipeline]
                 │
                 ▼
       [API Gateway & Auth]
                 │
                 ▼
     [Policy Evaluation Engine]
     ├── Exact & Wildcard Matcher
     ├── Deny-By-Default Enforcement
     └── Production Mutation Guardrails
                 │
  ┌──────────────┼──────────────┬──────────────┐
  ▼              ▼              ▼              ▼
[KV-v2 Engine] [Dynamic DB]  [Transit Engine] [Lease Manager]
├── AES-GCM    ├── Postgres  ├── Encryption   ├── Auto-expiry
├── Versions   ├── MySQL     └── Key Rotation └── Revocation
└── Metadata   └── MongoDB
```

## Key Capabilities

### 1. Granular Vault Policies & Deny-By-Default Access Model
- **Rule Definitions**: Precise rules defined per path (e.g. `secret/data/staging/*`, `transit/*`, `database/*`) with capabilities: `create`, `read`, `update`, `delete`, `list`, `deny`, `sudo`.
- **Precedence**: Strict deny-by-default — operations are blocked unless an active policy explicitly grants access. Explicit `"deny"` rules override all matching grants.
- **Production Guardrail**: Sensitive write/delete operations in `production` environments require extra confirmation.

### 2. Policy Simulator & Safe "Why Denied" Explanations
- Interactive policy tester allowing operators to simulate any request path and capability against project policies to receive instant human-readable explanations.

### 3. KV-v2 Secret Lifecycle & Metadata
- **Multi-Version History**: Retains historical secret iterations with actor tracking and timestamping.
- **Soft-Delete, Undelete & Destroy**: Multi-stage version deletion and permanent purging.
- **Secret Metadata**: Configurable TTLs, expiration dates, custom key-value tags, and automatic rotation alerts.

### 4. Dynamic Database Credentials Engine
- Generates ephemeral database users and passwords for PostgreSQL, MySQL, and MongoDB with custom TTLs and auto-revocation upon expiration.

### 5. Transit Cryptography Engine (Encryption-as-a-Service)
- Performs AES-256-GCM hardware encryption and decryption of application payloads without storing or exposing raw cryptographic keys.
- Supports customer-managed key version rotation (`rotateKey`).

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/vault/policies` | List project vault policies |
| `POST` | `/vault/policies` | Create vault policy |
| `GET` | `/vault/policies/:policyId` | Get policy details |
| `PUT` | `/vault/policies/:policyId` | Update policy rules |
| `DELETE` | `/vault/policies/:policyId` | Delete vault policy |
| `POST` | `/vault/policies/simulate` | Test/simulate policy evaluation |
| `PATCH` | `/vault/secrets/:env/:key/metadata` | Update secret metadata config |
| `POST` | `/vault/secrets/:env/:key/versions/:v/soft-delete` | Soft delete version |
| `POST` | `/vault/secrets/:env/:key/versions/:v/undelete` | Restore deleted version |
| `DELETE` | `/vault/secrets/:env/:key/versions/:v/destroy` | Permanently destroy version |
| `POST` | `/vault/dynamic/database/creds` | Generate dynamic DB credentials |
| `GET` | `/vault/dynamic/database/creds` | List active database leases |
| `POST` | `/vault/dynamic/database/creds/:leaseId/renew` | Renew database lease |
| `POST` | `/vault/dynamic/database/creds/:leaseId/revoke` | Revoke database lease |
| `POST` | `/vault/transit/encrypt` | Encrypt data with transit key |
| `POST` | `/vault/transit/decrypt` | Decrypt transit ciphertext |
| `POST` | `/vault/transit/keys/:keyName/rotate` | Rotate transit key version |
