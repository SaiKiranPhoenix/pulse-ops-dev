const allowedTypes = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "security",
  "test",
];

const title = process.env.PR_TITLE ?? "";
const pattern = new RegExp(`^(${allowedTypes.join("|")})(\\([a-z0-9-]+\\))?: .{8,}$`);

if (!pattern.test(title)) {
  console.error("Invalid PR title.");
  console.error("Use: type(scope): short description");
  console.error(`Allowed types: ${allowedTypes.join(", ")}`);
  console.error("Example: feat(auth): add registration endpoint");
  process.exit(1);
}

console.log("PR title is valid.");
