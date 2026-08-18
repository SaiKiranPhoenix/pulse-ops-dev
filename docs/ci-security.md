# CI And Security Workflow

PulseOps uses free-tier GitHub Actions checks plus local scripts to reduce the chance of security leaks.

## Workflows

- `CI`: format, lint, typecheck, build, and Docker Compose config validation.
- `Security`: local secret scan, Gitleaks, pnpm audit, and Trivy filesystem scan.
- `PR Review Guardrails`: branch naming, branch flow policy, PR metadata, changed-file policy, PR title check, local secret scan, and compose validation.
- `Feature Branch Checks`: branch naming, format, lint, typecheck, build, tests, local secret scan, Gitleaks, pnpm audit, Trivy filesystem scan, Compose validation, and Dockerfile build checks for working branch pushes.

## Branch Flow Policy

Use this merge flow:

- Feature branches merge into `development`.
- `development` merges into `main` or `master`.
- `hotfix` branches may merge directly into `main` or `master`.
- Hotfixes merged directly into `main` or `master` must be back-merged into `development`.

Allowed working branch prefixes:

- `feature/`
- `bugfix/`
- `hotfix/`
- `hotfix-`
- `docs/`
- `chore/`
- `ci/`
- `refactor/`
- `test/`
- `security/`
- `dependabot/`

Allowed direct PRs into `main` or `master`:

- `development` -> `main`
- `development` -> `master`
- `hotfix/security-issue` -> `main`
- `hotfix/security-issue` -> `master`

Blocked direct PRs into `main` or `master`:

- `feature/auth-api` -> `main`
- `feature/auth-api` -> `master`
- `bugfix/dashboard-cache` -> `main`
- `bugfix/dashboard-cache` -> `master`

The `Review readiness` job enforces this branch flow automatically for pull requests. To block direct pushes too, configure branch protection manually as described below.

## Feature Branch Push Policy

Pushes to `feature/**`, `bugfix/**`, `hotfix/**`, `hotfix-*`, `security/**`, `ci/**`, `chore/**`, `docs/**`, `refactor/**`, and `test/**` run the `Feature Branch Checks` workflow.

This workflow is intentionally validation-only. It never publishes container images and never deploys environments from feature branches.

## Pull Request Policy

The `Review readiness` job enforces:

- PR titles must use Conventional Commits, such as `feat(auth): add login endpoint`.
- PRs targeting `main` or `master` must include meaningful `Release Notes`.
- Hotfix PRs must include a meaningful `Hotfix Reason`.
- Hotfix PRs must include a meaningful `Back-Merge Plan`.
- `.env`, private key, certificate, and secret-like files are blocked.
- Service boundary or deployment contract changes must include docs or planning updates.
- Auth, vault, audit, security, or redaction source changes must include tests.

## Recommended Solo-Developer Branch Protection

Configure these manually in GitHub after pushing:

- Require status checks to pass before merging.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Require a pull request before merging into `main`, `master`, and `development`.
- Block force pushes and branch deletion on `main`, `master`, and `development`.
- Restrict who can push to `main` and `master` if your GitHub plan exposes that option.

Recommended required checks:

- `Workspace checks`
- `Secret and dependency checks`
- `Review readiness`
- `Feature workspace checks`

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
