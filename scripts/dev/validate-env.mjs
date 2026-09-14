#!/usr/bin/env node
/**
 * PulseOps — .env Validation Script
 *
 * Reads the .env file in the repository root, checks that every
 * required variable is present and not a placeholder value, and
 * prints a colour-coded report.
 *
 * Usage:
 *   pnpm env:validate
 *   node scripts/dev/validate-env.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── ANSI helpers ─────────────────────────────────────────────────
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const err = (s) => `\x1b[31m${s}\x1b[0m`;
const wrn = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bld = (s) => `\x1b[1m${s}\x1b[0m`;
const cyn = (s) => `\x1b[36m${s}\x1b[0m`;

// ── Placeholder strings that indicate a var is not set ───────────
const PLACEHOLDER_PATTERNS = [
  /^set-/i,
  /^replace-/i,
  /^your-/i,
  /^<.*>$/,
  /^TODO/i,
  /^CHANGEME/i,
  /^placeholder/i,
];

// ── Variable definitions ──────────────────────────────────────────
/** @type {Array<{ name: string; required: boolean; minLength?: number; note?: string }>} */
const VARS = [
  // Infrastructure connection
  { name: "MONGODB_URI", required: true, minLength: 10, note: "MongoDB connection string" },
  { name: "REDIS_URL", required: true, minLength: 10, note: "Redis connection URL" },
  { name: "RABBITMQ_URL", required: true, minLength: 10, note: "RabbitMQ AMQP URL" },
  { name: "RABBITMQ_DEFAULT_USER", required: true, minLength: 3 },
  { name: "RABBITMQ_DEFAULT_PASS", required: true, minLength: 8, note: "Change from default!" },

  // Secrets — must be strong
  { name: "JWT_SECRET", required: true, minLength: 32, note: "Min 32 chars" },
  { name: "API_KEY_PEPPER", required: true, minLength: 32, note: "Min 32 chars" },
  { name: "VAULT_MASTER_PASSWORD", required: true, minLength: 16 },
  { name: "VAULT_TOKEN_PEPPER", required: true, minLength: 16 },
  { name: "OAUTH_STATE_SECRET", required: true, minLength: 32, note: "Min 32 chars" },

  // OAuth — optional but warn if partially set
  { name: "OAUTH_GOOGLE_CLIENT_ID", required: false },
  { name: "OAUTH_GOOGLE_CLIENT_SECRET", required: false },
  { name: "OAUTH_GITHUB_CLIENT_ID", required: false },
  { name: "OAUTH_GITHUB_CLIENT_SECRET", required: false },

  // Service URLs
  { name: "PULSEOPS_API_BASE_URL", required: true },
  { name: "PULSEOPS_REALTIME_URL", required: true },
  { name: "CORS_ALLOWED_ORIGINS", required: true },
  { name: "OAUTH_CALLBACK_BASE_URL", required: true },
  { name: "OAUTH_SUCCESS_REDIRECT_URL", required: true },
  { name: "OAUTH_FAILURE_REDIRECT_URL", required: true },
];

// ── Parse .env file ───────────────────────────────────────────────
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

// ── Main ──────────────────────────────────────────────────────────
try {
  await main();
} catch (error) {
  console.error(err("Validation failed:"), error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function main() {
  const envPath = resolve(process.cwd(), ".env");

  console.log(`\n${bld(cyn("◈  PulseOps — .env Validation"))}\n`);

  if (!existsSync(envPath)) {
    console.log(err("✗ .env file not found at repository root."));
    console.log(dim("  Copy .env.example to .env and fill in all required values.\n"));
    console.log(`  ${dim("cp .env.example .env")}\n`);
    process.exit(1);
  }

  const env = parseEnvFile(envPath);
  let errors = 0;
  let warnings = 0;

  const W = 36;
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));

  console.log(dim(pad("Variable", W) + "  Status"));
  console.log(dim("─".repeat(W + 26)));

  for (const def of VARS) {
    const value = env[def.name] ?? "";
    const missing = value === "";
    const placeholder = !missing && isPlaceholder(value);
    const tooShort =
      !missing && !placeholder && def.minLength !== undefined && value.length < def.minLength;
    const note = def.note ? dim(`  (${def.note})`) : "";

    let statusStr;

    if (missing && def.required) {
      statusStr = err("✗ MISSING");
      errors++;
    } else if (missing) {
      statusStr = dim("○ not set") + dim("  (optional)");
    } else if (placeholder) {
      statusStr = err("✗ PLACEHOLDER");
      errors++;
    } else if (tooShort) {
      statusStr = wrn(`⚠ too short (${value.length} < ${def.minLength})`) + note;
      warnings++;
    } else {
      statusStr = ok("✓ ok") + note;
    }

    console.log("  " + pad(def.name, W - 2) + "  " + statusStr);
  }

  // OAuth pairing check — both halves of a provider must be set
  console.log(dim("\n" + "─".repeat(W + 26)));
  const googleId = env["OAUTH_GOOGLE_CLIENT_ID"] ?? "";
  const googleSecret = env["OAUTH_GOOGLE_CLIENT_SECRET"] ?? "";
  const githubId = env["OAUTH_GITHUB_CLIENT_ID"] ?? "";
  const githubSecret = env["OAUTH_GITHUB_CLIENT_SECRET"] ?? "";

  if ((googleId !== "") !== (googleSecret !== "")) {
    console.log(wrn("  ⚠ Google OAuth: only one of CLIENT_ID / CLIENT_SECRET is set."));
    warnings++;
  }
  if ((githubId !== "") !== (githubSecret !== "")) {
    console.log(wrn("  ⚠ GitHub OAuth: only one of CLIENT_ID / CLIENT_SECRET is set."));
    warnings++;
  }

  // Summary
  console.log();
  if (errors > 0) {
    console.log(
      err(
        `✗ ${errors} error(s), ${warnings} warning(s). Fix required vars before starting the stack.\n`,
      ),
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(wrn(`⚠ ${warnings} warning(s). Stack can start but review flagged variables.\n`));
  } else {
    console.log(ok(`✓ All required variables are set. Ready to start the stack.\n`));
  }
}
