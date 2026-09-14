import { execFileSync } from "node:child_process";

const baseBranch = process.env.PR_BASE_BRANCH ?? process.env.GITHUB_BASE_REF ?? "";
const changedFilesFromEnv = process.env.PR_CHANGED_FILES ?? "";

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function changedFilesFromGit() {
  if (!baseBranch) {
    throw new Error("Missing PR base branch name.");
  }

  try {
    runGit(["fetch", "origin", baseBranch, "--depth=1"]);
  } catch {
    // Fetch may be unnecessary when checkout already has the base ref.
  }

  const diffTargets = [`origin/${baseBranch}...HEAD`, `${baseBranch}...HEAD`];

  for (const target of diffTargets) {
    try {
      const output = runGit(["diff", "--name-only", target]);
      return output.split(/\r?\n/);
    } catch {
      // Try the next diff target.
    }
  }

  throw new Error(`Unable to determine changed files against ${baseBranch}.`);
}

function getChangedFiles() {
  if (changedFilesFromEnv.trim()) {
    return unique(changedFilesFromEnv.split(/[\r\n,]+/).map((file) => file.trim()));
  }

  return unique(changedFilesFromGit());
}

function isEnvExample(filePath) {
  return filePath === ".env.example" || filePath.endsWith("/.env.example");
}

function isForbiddenSecretFile(filePath) {
  const lower = filePath.toLowerCase();
  const basename = lower.split("/").at(-1) ?? lower;

  if ((basename === ".env" || basename.startsWith(".env.")) && !isEnvExample(lower)) {
    return true;
  }

  return (
    /\.(pem|key|p12|pfx|jks)$/i.test(filePath) ||
    /(^|\/)(id_rsa|id_ed25519|id_ecdsa|known_hosts)$/i.test(filePath) ||
    /(^|\/)secrets?\.(json|ya?ml|env|txt)$/i.test(filePath)
  );
}

function isDocumentationFile(filePath) {
  return (
    filePath.startsWith("docs/") ||
    filePath.startsWith("planning/") ||
    filePath === "README.md" ||
    filePath === "SECURITY.md"
  );
}

function isTestFile(filePath) {
  return /(^|\/)tests?\//i.test(filePath) || /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/i.test(filePath);
}

function isSourceLikeFile(filePath) {
  return /\.(ts|tsx|js|mjs|cjs)$/i.test(filePath);
}

function isBoundaryFile(filePath) {
  return (
    filePath === "compose.yaml" ||
    filePath.endsWith("/Dockerfile") ||
    filePath === ".github/workflows/container-images.yml" ||
    /^po-shared\/src\/(contracts|messaging|mongo|redis)\//.test(filePath) ||
    /^po-[^/]+\/src\/(events|models)\//.test(filePath)
  );
}

function isSecuritySensitiveSource(filePath) {
  if (!isSourceLikeFile(filePath)) {
    return false;
  }

  return (
    /^po-auth-project-service\/src\//.test(filePath) ||
    /^po-vault-service\/src\//.test(filePath) ||
    /^po-shared\/src\/security\//.test(filePath) ||
    /^scripts\/security\//.test(filePath) ||
    /\/middlewares\/(auth|audit)\.middleware\.ts$/.test(filePath) ||
    /\/(auth|vault|security)\./i.test(filePath)
  );
}

const changedFiles = getChangedFiles();
const forbiddenSecretFiles = changedFiles.filter(isForbiddenSecretFile);
const boundaryFiles = changedFiles.filter(isBoundaryFile);
const docsUpdated = changedFiles.some(isDocumentationFile);
const securitySensitiveSources = changedFiles.filter(isSecuritySensitiveSource);
const testsUpdated = changedFiles.some(isTestFile);

const failures = [];

if (forbiddenSecretFiles.length > 0) {
  failures.push(
    [
      "Forbidden secret-like files were changed:",
      ...forbiddenSecretFiles.map((file) => `  - ${file}`),
      "Only placeholder .env.example files are allowed.",
    ].join("\n"),
  );
}

if (boundaryFiles.length > 0 && !docsUpdated) {
  failures.push(
    [
      "Service boundary or deployment contract files changed without docs/planning updates:",
      ...boundaryFiles.map((file) => `  - ${file}`),
      "Update docs/ or planning/ so ownership and deployment decisions stay traceable.",
    ].join("\n"),
  );
}

if (securitySensitiveSources.length > 0 && !testsUpdated) {
  failures.push(
    [
      "Security-sensitive source files changed without tests:",
      ...securitySensitiveSources.map((file) => `  - ${file}`),
      "Add or update tests for auth, vault, audit, security, or redaction behavior.",
    ].join("\n"),
  );
}

if (failures.length > 0) {
  console.error("PR file policy failed:");
  for (const failure of failures) {
    console.error(`\n${failure}`);
  }
  process.exit(1);
}

console.log(`PR file policy passed for ${changedFiles.length} changed file(s).`);
