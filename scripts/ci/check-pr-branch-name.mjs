const branchName = process.env.PR_HEAD_BRANCH ?? process.env.GITHUB_HEAD_REF ?? "";

const exactAllowedBranches = new Set(["development", "hotfix"]);
const allowedPrefixes = [
  "feature/",
  "bugfix/",
  "hotfix/",
  "hotfix-",
  "docs/",
  "chore/",
  "ci/",
  "refactor/",
  "test/",
  "security/",
  "dependabot/",
];

if (!branchName) {
  console.error("Missing PR head branch name.");
  process.exit(1);
}

const isAllowed =
  exactAllowedBranches.has(branchName) ||
  allowedPrefixes.some((prefix) => branchName.startsWith(prefix));

if (!isAllowed) {
  console.error(`Invalid branch name: ${branchName}`);
  console.error(`Use one of these prefixes: ${allowedPrefixes.join(", ")}`);
  console.error("Examples: feature/auth-service, bugfix/api-key-rotation, hotfix/security-issue");
  process.exit(1);
}

console.log(`Branch name is valid: ${branchName}`);
