const protectedTargets = new Set(["main", "master"]);

const baseBranch = process.env.PR_BASE_BRANCH ?? process.env.GITHUB_BASE_REF ?? "";
const headBranch = process.env.PR_HEAD_BRANCH ?? process.env.GITHUB_HEAD_REF ?? "";
const body = process.env.PR_BODY ?? "";

function isHotfixBranch(branchName) {
  return (
    branchName === "hotfix" || branchName.startsWith("hotfix/") || branchName.startsWith("hotfix-")
  );
}

function sectionContent(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "im");
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function hasMeaningfulContent(content) {
  if (!content) {
    return false;
  }

  const normalized = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[-*]\s*\[\s\]/g, "")
    .trim()
    .toLowerCase();

  return (
    normalized.length > 0 &&
    ![
      "n/a",
      "na",
      "none",
      "not applicable",
      "describe release notes for users/operators.",
      "explain why this hotfix must bypass development.",
      "explain how this hotfix will be merged back into development.",
    ].includes(normalized)
  );
}

const failures = [];

if (protectedTargets.has(baseBranch)) {
  const releaseNotes = sectionContent(body, "Release Notes");
  if (!hasMeaningfulContent(releaseNotes)) {
    failures.push(
      "PRs targeting main/master must include meaningful content under ## Release Notes.",
    );
  }
}

if (isHotfixBranch(headBranch)) {
  const hotfixReason = sectionContent(body, "Hotfix Reason");
  const backMergePlan = sectionContent(body, "Back-Merge Plan");

  if (!hasMeaningfulContent(hotfixReason)) {
    failures.push("Hotfix PRs must include meaningful content under ## Hotfix Reason.");
  }

  if (!hasMeaningfulContent(backMergePlan)) {
    failures.push("Hotfix PRs must include meaningful content under ## Back-Merge Plan.");
  }
}

if (failures.length > 0) {
  console.error("PR metadata policy failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PR metadata policy passed.");
