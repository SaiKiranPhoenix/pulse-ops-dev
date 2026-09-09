# Vault secret delivery, crypto, and compliance notes

PulseOps stores KV secrets as AES-256-GCM ciphertext with a random salt and IV for every
encryption. New encrypted records include KDF metadata and `keyVersion: 1`; older records without
those fields remain readable and should be re-saved during maintenance windows to attach current
metadata.

## Runtime secret delivery

Services should fetch an environment bundle at startup with a scoped Vault token:

```bash
curl -H "x-vault-token: $PULSEOPS_VAULT_TOKEN" \
  "$PULSEOPS_VAULT_URL/integrations/vault/env/production"
```

The response contains decrypted values, a `.env` formatted export, and a renewable lease. Treat the
response as sensitive:

- never log the response body;
- never commit generated `.env` files;
- renew the lease before `expiresAt` or fetch a fresh bundle;
- revoke the lease when a deployment or service instance is retired.

For container platforms, inject only the scoped token and service URL as platform secrets. Fetch the
bundle inside the entrypoint or application bootstrap, then keep values in process memory.

Example startup flow:

```bash
node scripts/fetch-vault-env.mjs > /tmp/runtime.env
set -a
. /tmp/runtime.env
set +a
node dist/server.js
```

## Rotation

KV versions provide rotation history. `metadata.rotationPeriodDays`,
`metadata.nextRotationDate`, and `metadata.autoRotateEnabled` drive dashboard visibility for due
rotations. Rotation is performed by writing a new value to the same secret key; previous versions
stay listed for audit review without exposing historical plaintext.

## Crypto operations

The Vault service uses scrypt-derived AES-GCM keys. Because the master password is not recoverable
from stored ciphertext, losing it makes stored secrets unrecoverable. Back up both MongoDB data and
the configured master password in a secure external password manager before relying on this in
shared environments.

Key-version metadata is present for future encryption-key rotation. A production rotation flow
should decrypt each active secret with its current key version, re-encrypt with the next key version,
and keep a signed migration manifest.

Transit encryption/decryption endpoints are available under `/vault/transit/*` for encryption as a
service. They are separate from KV storage encryption and should be used when applications need
PulseOps to encrypt payloads without storing the plaintext.

## Audit backends and compliance

The local MVP uses the MongoDB audit backend. It supports durable storage, audit export, compliance
reporting, and an integrity check that computes a deterministic hash chain over returned audit
events. File and webhook backends are documented as planned extension points for append-only local
archives and external SIEM/GRC delivery.

Audit exports are available at `/audit/events/export`. The compliance report at
`/audit/compliance/report` summarizes secret access by actor and failed reveal/fetch attempts. The
integrity endpoint at `/audit/compliance/integrity` returns the current chain head hash for evidence
capture.
