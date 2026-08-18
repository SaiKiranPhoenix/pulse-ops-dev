# PulseOps Security Threat Model

## Scope

This threat model covers MVP security for:

- user authentication
- project ownership
- API key ingestion
- telemetry payload handling
- RabbitMQ messages
- Redis caches
- MongoDB stored data
- vault secret encryption and reveal
- vault integration tokens
- audit logs
- dashboard realtime access

## Assets

| Asset | Protection Need |
| --- | --- |
| user password | hash only, never logged |
| JWT | never logged, short-lived |
| API key | hash at rest, raw returned once |
| vault password | never stored or logged |
| secret value | encrypted at rest, never cached raw |
| integration token | hash at rest, raw returned once |
| audit log | tamper-resistant enough for MVP |
| telemetry metadata | redacted and size-limited |
| project data | owner-isolated |

## Trust Boundaries

- Browser to API gateway.
- External app to ingestion APIs.
- External app to vault integration APIs.
- HTTP services to Redis/MongoDB/RabbitMQ.
- Ingestion request path to async worker path.
- Vault service to audit queue.
- Realtime gateway to browser sockets.

## Threats And Controls

| Threat | Risk | Control |
| --- | --- | --- |
| leaked API key | unauthorized ingestion | hash keys, prefix display only, rotate/disable, rate limit |
| brute-force API key | ingestion abuse | high-entropy keys, rate limits, generic errors |
| telemetry secret leakage | secrets stored in events | redaction, metadata size limits, blocked key names |
| duplicate ingestion | inflated counts/incidents | idempotency key and worker idempotency |
| worker redelivery duplicates | duplicate events | unique message id and durable dedupe |
| queue poison message | infinite retry loop | max attempts and DLQ |
| stolen integration token | secret exfiltration | hash at rest, expiry, revoke, scopes, audit |
| wrong project access | tenant isolation failure | ownership checks and token project/env scope |
| vault password brute force | secret decrypt attempts | expensive KDF, rate limit reveal attempts, audit failures |
| AES-GCM misuse | decrypt failure or compromise | unique IV per encryption, auth tag verification |
| audit log leakage | sensitive data in audit | allowlist audit fields only |
| realtime room abuse | data leak across projects | JWT auth and ownership check before room join |
| logs leak secrets | accidental disclosure | logger redaction by default |
| Redis leak | cached sensitive data | never cache raw secrets/tokens/passwords |

## Vault-Specific Controls

- Use AES-256-GCM for secret values.
- Use Argon2id preferred, scrypt fallback for deriving keys from vault password.
- Generate unique salt and IV/nonce.
- Store KDF parameters with encrypted record.
- Store token hash and safe prefix only.
- Return raw integration token once.
- Reveal secret only from explicit reveal endpoint.
- Use POST for reveal to avoid secret-sensitive inputs in URL logs.
- Set no-store cache headers on reveal/fetch responses.
- Audit success and failure for every sensitive operation.

## Logging Policy

Never log:

- request bodies for auth and vault routes
- `Authorization`
- `Cookie`
- `x-api-key`
- `idempotency-key` if it can identify clients
- secret values
- vault password
- raw integration token
- JWT
- database URLs

Allowed log identifiers:

- request id
- correlation id
- project id
- user id
- token prefix
- secret key name
- event id
- queue name

## Abuse Cases

| Abuse Case | Expected Response |
| --- | --- |
| client floods ingestion | Redis rate limit returns `429` |
| invalid API key repeated | generic `401`, no key existence leak |
| expired vault token fetch | `401`, audit failure |
| staging token asks production secrets | `403`, audit failure |
| user reveals with wrong password | `401`, audit failure |
| socket joins unauthorized project | reject room join and disconnect or emit forbidden |
| payload includes `DATABASE_URL` in metadata | redact or reject based on validation policy |

## Security Acceptance Criteria

- Searching MongoDB for a seeded secret value finds no raw value.
- Secret list response never includes decrypted values.
- Logs from auth, ingestion, vault, and workers contain no raw credentials.
- Integration token cannot be recovered from database.
- API key cannot be recovered from database.
- Wrong vault password cannot decrypt and returns a generic error.
- Audit logs show sensitive action history without sensitive payloads.
- Realtime subscriptions cannot cross project ownership.

## Known MVP Limitations

- No hardware-backed key management.
- No organization/team RBAC.
- No advanced anomaly detection.
- No formal tamper-proof audit storage.
- No distributed tracing.
- No production HA deployment.

These limitations should be stated in README as deliberate MVP boundaries.
