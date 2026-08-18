## Summary

Describe what changed and why.

## Release Notes

Describe release notes for users/operators. Required for PRs targeting `main` or `master`.

## Hotfix Reason

Explain why this hotfix must bypass `development`. Required only for `hotfix/*` PRs.

## Back-Merge Plan

Explain how this hotfix will be merged back into `development`. Required only for `hotfix/*` PRs.

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

- [ ] Branch flow is valid: features target `development`; only `development` or `hotfix/*` targets `main`/`master`.
- [ ] Branch name uses an allowed prefix: `feature/`, `bugfix/`, `hotfix/`, `hotfix-`, `docs/`, `chore/`, `ci/`, `refactor/`, `test/`, `security/`, or `dependabot/`.
- [ ] Security-sensitive code changes include tests.
- [ ] Service boundary/deployment contract changes include docs or planning updates.
- [ ] No `.env`, private key, certificate, or secret-like files were added.
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm security:secrets`
- [ ] `pnpm security:audit`
- [ ] `docker compose config --quiet`

## Screenshots Or Evidence

Add screenshots, logs, or command output when useful. Redact all sensitive values.
