import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ignoredDirectories = new Set([
  ".git",
  ".github",
  ".pnpm-store",
  ".vite",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "planning",
]);

const ignoredFiles = new Set(["pnpm-lock.yaml"]);

const scannedExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const allowlistedFragments = [
  "set-local-rabbitmq-password",
  "set-local-jwt-secret-minimum-32-characters",
  "pulseops.accessToken",
];

const rules = [
  {
    name: "AWS access key",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "Private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
  },
  {
    name: "GitHub token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
  {
    name: "Stripe live secret key",
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
  },
  {
    name: "Slack token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  },
  {
    name: "Google API key",
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
  },
  {
    name: "JWT literal",
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    name: "Hardcoded sensitive assignment",
    pattern:
      /\b(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|jwt[_-]?secret)\b\s*[:=]\s*["'][^"'<>{}\s][^"']{11,}["']/gi,
  },
  {
    name: "Database URL with credentials",
    pattern: /\b(?:mongodb|postgres|mysql|redis):\/\/[^/\s:@]+:[^@\s]+@/gi,
  },
];

function shouldSkipDirectory(directoryName) {
  return ignoredDirectories.has(directoryName);
}

function shouldScanFile(filePath) {
  const fileName = path.basename(filePath);
  if (ignoredFiles.has(fileName)) {
    return false;
  }

  if (fileName.endsWith(".env.example")) {
    return true;
  }

  return scannedExtensions.has(path.extname(filePath));
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    if (entry.isFile() && shouldScanFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function isAllowlisted(line) {
  return allowlistedFragments.some((fragment) => line.includes(fragment));
}

const findings = [];

for (const filePath of walk(root)) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isAllowlisted(line)) {
      return;
    }

    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        findings.push({
          file: path.relative(root, filePath),
          line: index + 1,
          rule: rule.name,
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Potential secret leaks found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.rule}`);
  }
  process.exit(1);
}

console.log("No obvious secret leaks found.");
