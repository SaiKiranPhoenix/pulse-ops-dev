import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default async function globalSetup(): Promise<void> {
  await execFileAsync("node", ["scripts/e2e/check-stack-health.mjs"], {
    env: process.env,
    timeout: 30_000,
  });
}
