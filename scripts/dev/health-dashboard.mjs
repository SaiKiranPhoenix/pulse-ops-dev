#!/usr/bin/env node
/**
 * PulseOps — Local Stack Health Dashboard
 *
 * Prints a colour-coded table of every service's Docker status and
 * HTTP health endpoint response. Run with:
 *
 *   pnpm health
 *   node scripts/dev/health-dashboard.mjs
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── ANSI colour helpers ───────────────────────────────────────────
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const wrn = (s) => `\x1b[33m${s}\x1b[0m`;
const err = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bld = (s) => `\x1b[1m${s}\x1b[0m`;
const cyn = (s) => `\x1b[36m${s}\x1b[0m`;

// ── Service definitions ───────────────────────────────────────────
const SERVICES = [
  // Infrastructure
  { name: "mongodb", profile: "infra", port: 27018, healthUrl: null, label: "MongoDB" },
  { name: "redis", profile: "infra", port: 6379, healthUrl: null, label: "Redis" },
  {
    name: "rabbitmq",
    profile: "infra",
    port: 15672,
    healthUrl: "http://localhost:15672",
    label: "RabbitMQ",
  },
  {
    name: "mailhog",
    profile: "infra",
    port: 8025,
    healthUrl: "http://localhost:8025",
    label: "MailHog",
  },
  // Applications
  { name: "po-ui", profile: "apps", port: 3000, healthUrl: "http://localhost:3000", label: "UI" },
  {
    name: "po-backend",
    profile: "apps",
    port: 4000,
    healthUrl: "http://localhost:4000/health",
    label: "Backend Monolith",
  },
];

// ── Main ──────────────────────────────────────────────────────────
try {
  await main();
} catch (error) {
  console.error(
    err("Health dashboard failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}

async function main() {
  console.clear();
  console.log(
    `\n${bld(cyn("◈  PulseOps — Local Stack Health"))}  ${dim(new Date().toLocaleTimeString())}\n`,
  );

  const dockerStatuses = await getDockerStatuses();

  const W = { label: 22, port: 7, docker: 14, http: 9, latency: 10 };
  const sepLen = W.label + W.port + W.docker + W.http + W.latency + 4;
  const sep = "─".repeat(sepLen);

  console.log(
    dim(pad("Service", W.label)) +
      dim(pad("Port", W.port)) +
      dim(pad("Docker", W.docker)) +
      dim(pad("HTTP", W.http)) +
      dim("Latency"),
  );
  console.log(dim(sep));

  console.log(dim("  Infrastructure"));
  for (const svc of SERVICES.filter((s) => s.profile === "infra")) {
    await printRow(svc, dockerStatuses, W);
  }

  console.log(dim("  Applications"));
  for (const svc of SERVICES.filter((s) => s.profile === "apps")) {
    await printRow(svc, dockerStatuses, W);
  }

  console.log(dim(sep));

  console.log(`\n${bld("Dashboard URLs:")}`);
  console.log(`  ${cyn("UI")}             http://localhost:3000`);
  console.log(`  ${cyn("API")}            http://localhost:4000`);
  console.log(`  ${cyn("Realtime")}       http://localhost:4000`);
  console.log(`  ${cyn("RabbitMQ Mgmt")} http://localhost:15672`);
  console.log(`  ${cyn("MailHog")}        http://localhost:8025`);
  console.log(`  ${cyn("MongoDB")}        localhost:27018  (Compass / mongosh)`);
  console.log();
}

async function getDockerStatuses() {
  try {
    const { stdout } = await execFileAsync("docker", [
      "compose",
      "--profile",
      "apps",
      "ps",
      "--format",
      "json",
    ]);
    const rows = stdout
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
    return new Map(rows.map((r) => [r.Service, r]));
  } catch {
    return new Map();
  }
}

async function probeHttp(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return { status: res.status, ok: res.ok, ms: Date.now() - start };
  } catch {
    return { status: 0, ok: false, ms: Date.now() - start };
  }
}

async function printRow(svc, dockerStatuses, W) {
  const entry = dockerStatuses.get(svc.name);
  const state = entry ? String(entry.State ?? "").toLowerCase() : "";
  const health = entry ? String(entry.Health ?? "").toLowerCase() : "";

  let dockerLabel;
  let dockerFmt;
  if (!entry) {
    dockerLabel = "not started";
    dockerFmt = dim;
  } else if (state === "running" && (!health || health === "healthy")) {
    dockerLabel = "running ✓";
    dockerFmt = ok;
  } else if (state === "running" && health === "starting") {
    dockerLabel = "starting…";
    dockerFmt = wrn;
  } else if (state === "running") {
    dockerLabel = `run / ${health}`;
    dockerFmt = wrn;
  } else {
    dockerLabel = state || "unknown";
    dockerFmt = err;
  }

  let httpLabel = dim("—");
  let latencyLabel = dim("—");

  if (svc.healthUrl !== null && entry) {
    const probe = await probeHttp(svc.healthUrl);
    if (probe.ok) {
      httpLabel = ok(String(probe.status));
      latencyLabel =
        probe.ms < 150
          ? ok(`${probe.ms}ms`)
          : probe.ms < 600
            ? wrn(`${probe.ms}ms`)
            : err(`${probe.ms}ms`);
    } else if (probe.status > 0) {
      httpLabel = err(String(probe.status));
      latencyLabel = err(`${probe.ms}ms`);
    } else {
      httpLabel = err("timeout");
      latencyLabel = dim("—");
    }
  }

  console.log(
    "  " +
      pad(svc.label, W.label - 2) +
      dim(pad(String(svc.port), W.port)) +
      pad(dockerFmt(dockerLabel), W.docker + 10) +
      pad(httpLabel, W.http + 10) +
      latencyLabel,
  );
}

/** Pad a string to a fixed display width, ignoring ANSI escape codes. */
function pad(str, width) {
  // eslint-disable-next-line no-control-regex
  const raw = str.replace(/\x1b\[[0-9;]*m/g, "");
  return str + " ".repeat(Math.max(0, width - raw.length));
}
