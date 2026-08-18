# Security Policy

PulseOps is built with a security-first workflow. Do not commit real secrets, tokens, private keys, JWTs, database URLs with credentials, or production `.env` files.

## Required Local Checks

Run these before opening a PR:

```powershell
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd security:secrets
pnpm.cmd security:audit
docker compose config --quiet
```

## Secret Handling Rules

- Use `.env.example` for fake local placeholders only.
- Keep real `.env` files untracked.
- Never log authorization headers, JWTs, API keys, vault passwords, integration tokens, or secret values.
- Never paste real credentials into planning docs, tests, screenshots, issues, or PR comments.
- If a secret is committed, rotate it immediately and treat the repository history as compromised.

## Free-Tier Security Stack

- GitHub Actions CI for format, lint, typecheck, build, and compose validation.
- Local secret scanner in `scripts/security/scan-secrets.mjs`.
- Gitleaks workflow for repository secret scanning.
- pnpm audit for dependency vulnerability checks.
- Trivy filesystem scan for dependency, secret, and config issues.

## Reporting

This is a local portfolio project. Report security issues privately to the repository owner.
