const protectedTargets = new Set(["main", "master"]);

const baseBranch = process.env.PR_BASE_BRANCH ?? process.env.GITHUB_BASE_REF ?? "";
const headBranch = process.env.PR_HEAD_BRANCH ?? process.env.GITHUB_HEAD_REF ?? "";

function isHotfixBranch(branchName) {
  return (
    branchName === "hotfix" || branchName.startsWith("hotfix/") || branchName.startsWith("hotfix-")
  );
}

function isAllowedIntoProtectedTarget(branchName) {
  return branchName === "development" || isHotfixBranch(branchName);
}

if (!baseBranch || !headBranch) {
  console.error("Missing PR branch context. Expected base and head branch names.");
  process.exit(1);
}

if (protectedTargets.has(baseBranch) && !isAllowedIntoProtectedTarget(headBranch)) {
  console.error(
    [
      `Invalid branch flow: ${headBranch} -> ${baseBranch}`,
      "Only development or hotfix branches may merge into main/master.",
      "Feature branches must merge into development first.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Branch flow allowed: ${headBranch} -> ${baseBranch}`);
