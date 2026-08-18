# PulseOps Vault Security Architecture

## Security Goal

PulseOps Vault demonstrates secure handling of developer secrets without claiming to replace a production secrets manager. The MVP must prove encryption at rest, strict reveal paths, hashed integration tokens, environment separation, and complete audit logging.

## Core Rules

- Raw secret values are never stored.
- Vault password is never stored.
- Raw integration tokens are never stored.
- Secret values are never returned from list APIs.
- Decrypted values exist only in request memory for reveal/fetch responses.
- Logs and audit records never contain secret values, vault passwords, raw tokens, or auth headers.

## Vault Password Flow

1. User chooses a vault password separate from the account password.
2. Vault service generates a salt and KDF metadata.
3. A key-encryption or verification record is stored without storing the password.
4. For each reveal/update operation, user provides the vault password.
5. Vault derives the key with Argon2id preferred; scrypt is fallback if Argon2id package is unavailable.
6. Derivation failure or AES-GCM auth failure returns `401`.

MVP limitation:

- If the user forgets the vault password, secrets cannot be recovered. The only safe action is reset vault and delete/recreate secrets.

## Secret Encryption Flow

1. Validate project ownership and environment.
2. Validate secret key name with env-var-safe naming rules.
3. Redact sensitive request body before logging.
4. Derive encryption key from vault password and salt.
5. Encrypt value with AES-256-GCM using a unique IV/nonce.
6. Store ciphertext, IV, auth tag, salt, KDF metadata, key name, environment, version, and timestamps.
7. Publish audit event with action `secret.created` or `secret.updated`.

## Secret Reveal Flow

1. Authenticated user requests a specific secret reveal.
2. Vault checks project ownership.
3. User supplies vault password.
4. Vault derives key and decrypts in memory.
5. Vault returns only the requested value.
6. Vault publishes audit event with action `secret.revealed`.
7. Response must set no-store cache headers.

Failure cases:

- wrong vault password: `401`, audit failure result
- missing secret: `404`, audit failure result without leaking whether key exists to unauthorized users
- audit publish failure: fail closed for reveal

## Integration Token Generation

1. Authenticated project owner creates token for project/environment.
2. Vault generates high-entropy raw token.
3. Vault stores token hash, prefix, scopes, expiry, status, and metadata.
4. Raw token is returned once.
5. Audit event records token creation with safe prefix only.

Scopes:

- MVP: `secrets:read`
- Later: per-key scopes, write scopes, and service identity policies.

## Integration Token Validation

1. External app sends `Authorization: Bearer <token>`.
2. Vault hashes token and checks Redis `vaultToken:{tokenHash}`.
3. On cache miss, Vault checks MongoDB.
4. Token must be active, unexpired, and scoped to requested project/environment.
5. Cache only safe metadata for 5 minutes.

## External Secret Fetch Flow

Endpoints:

- `GET /api/v1/secrets?projectId=<id>&env=<env>`
- `GET /api/v1/secrets/:key?projectId=<id>&env=<env>`

Rules:

- Integration tokens can fetch decrypted values for their allowed environment.
- Responses must not include vault metadata that helps attack encryption.
- Audit every success and failure.
- Rate limit token-based fetches per token and project.

## Stored In MongoDB

Secrets:

- project id
- environment
- key name
- encrypted value
- IV/nonce
- auth tag
- salt
- KDF parameters
- version
- lifecycle metadata

Vault tokens:

- token hash
- token prefix
- project id
- environment
- scopes
- status
- expiry
- last used timestamp

Audit:

- actor type
- actor id or token prefix
- action
- result
- secret key name
- request metadata
- timestamps

## Cached In Redis

Allowed:

- hashed token validation metadata
- rate limits for integration fetches
- recent audit list invalidation flags

Forbidden:

- raw token
- raw secret
- decrypted secret
- vault password
- derived encryption key
- authorization header

## Secret Rotation And Deletion

Rotation:

- update encrypted value
- increment secret version
- audit `secret.rotated`
- invalidate dashboard and integration cache where relevant

Deletion:

- soft delete for audit-preserving MVP
- never return deleted secrets
- audit `secret.deleted`

## Environment Separation

- Secret uniqueness is scoped by project + environment + key.
- Integration token access is scoped to one project and one environment in MVP.
- Dashboard selector must always show active environment.
- Accidentally fetching production secrets with a staging token must return `403`.

## Limitations Compared With HashiCorp Vault

- No HSM/KMS integration.
- No dynamic database credentials.
- No leases for generated credentials.
- No complex policy language.
- No sealed/unsealed operational model.
- No high-availability cluster.
- No enterprise audit backend.

The README must state this honestly: PulseOps Vault is an educational secure vault feature inside a broader DevOps platform.
