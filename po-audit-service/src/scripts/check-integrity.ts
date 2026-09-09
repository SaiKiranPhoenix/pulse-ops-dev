import { loadEnv } from "../config/env.js";
import { connectMongo, disconnectMongo } from "../config/database.js";
import { createAuditServiceDependencies } from "../services/dependencies.js";

async function main(): Promise<void> {
  const projectId = process.argv[2];

  if (projectId === undefined || projectId.trim().length === 0) {
    throw new Error("Usage: pnpm --filter po-audit-service audit:integrity <projectId>");
  }

  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  const dependencies = createAuditServiceDependencies();

  try {
    const integrity = await dependencies.auditService.checkIntegrity({ projectId });
    console.log(JSON.stringify(integrity, null, 2));
  } finally {
    await disconnectMongo();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Audit integrity check failed");
  process.exitCode = 1;
});
