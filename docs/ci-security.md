# CI And Security Workflow

PulseOps uses free-tier GitHub Actions checks plus local scripts to reduce the chance of security leaks.

## Workflows

- `CI`: format, lint, typecheck, build, and Docker Compose config validation.
- `Security`: local secret scan, Gitleaks, pnpm audit, and Trivy filesystem scan.
- `PR Review Guardrails`: PR title check, local secret scan, and compose validation.

## Recommended Solo-Developer Branch Protection

Configure these manually in GitHub after pushing:

- Require status checks to pass before merging.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion on `main`.

Recommended required checks:

- `Workspace checks`
- `Secret and dependency checks`
- `Review readiness`

Do not require external reviewers for this solo project. Use the PR template as a self-review checklist and let automated checks catch formatting, type, build, dependency, compose, and secret-scan issues.

## Free-Tier Notes

These workflows avoid paid deployment platforms and paid security products. GitHub-hosted Actions minutes and package registry access are enough for this project. CodeQL and GitHub Advanced Security are intentionally not required because private repository availability may depend on plan settings.

## Local Commands

```powershell
pnpm.cmd format:check
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd security:secrets
pnpm.cmd security:audit
docker compose config --quiet
```

Use fake values only in `.env.example`. Keep real `.env` files local and ignored.
