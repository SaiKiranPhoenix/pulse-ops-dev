## Summary

Describe what changed and why.

## Type

- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Docs
- [ ] CI/build
- [ ] Security

## Self-Review Security Checklist

- [ ] No real secrets, tokens, JWTs, private keys, database URLs, or credentials were added.
- [ ] New logs do not include request bodies, auth headers, API keys, vault passwords, secret values, or tokens.
- [ ] New `.env` values are documented only as fake placeholders in `.env.example`.
- [ ] New auth, vault, ingestion, or audit behavior includes failure handling.
- [ ] Sensitive values are redacted before logging or audit persistence.

## Validation Before Merge

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm security:secrets`
- [ ] `pnpm security:audit`
- [ ] `docker compose config --quiet`

## Screenshots Or Evidence

Add screenshots, logs, or command output when useful. Redact all sensitive values.
