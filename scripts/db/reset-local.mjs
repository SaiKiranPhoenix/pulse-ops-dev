import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const args = new Set(process.argv.slice(2));
const shouldStart = args.has("--start") || args.has("--seed");
const shouldSeed = args.has("--seed");

try {
  await main();
} catch (error) {
  console.error("");
  console.error("Local reset failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function main() {
  assertPulseOpsWorkspace();

  console.log("PulseOps safe local reset");
  console.log("");
  console.log("This removes only Docker Compose resources for this repository:");
  console.log("- containers");
  console.log("- networks");
  console.log("- named volumes, including local MongoDB, Redis, and RabbitMQ data");
  console.log("");

  if (!args.has("--yes")) {
    const confirmed = await askForConfirmation();

    if (!confirmed) {
      console.log("Reset cancelled.");
      return;
    }
  }

  run("docker", ["compose", "down", "--volumes", "--remove-orphans"]);

  if (shouldStart) {
    run("docker", ["compose", "--profile", "apps", "up", "-d"]);
  }

  if (shouldSeed) {
    run(process.execPath, ["scripts/db/seed-demo.mjs"]);
  }

  console.log("");
  console.log("Local reset complete.");
}

function assertPulseOpsWorkspace() {
  if (!existsSync("compose.yaml")) {
    throw new Error("compose.yaml was not found. Run this command from the repository root.");
  }

  if (!existsSync("package.json")) {
    throw new Error("package.json was not found. Run this command from the repository root.");
  }

  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  if (packageJson.name !== "pulse-ops") {
    throw new Error("This reset script only runs from the pulse-ops repository root.");
  }
}

async function askForConfirmation() {
  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question('Type "reset local pulseops" to continue: ');
    return answer.trim() === "reset local pulseops";
  } finally {
    rl.close();
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status}.`);
  }
}
