import { loadEnv } from "../config/env.js";
import { connectMongo, disconnectMongo } from "../config/database.js";
import { createVaultServiceDependencies } from "../services/dependencies.js";

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  const dependencies = createVaultServiceDependencies();

  try {
    const expired = await dependencies.vaultService.expireDueLeases();
    console.log(JSON.stringify({ expiredLeases: expired.length }, null, 2));
  } finally {
    await dependencies.close();
    await disconnectMongo();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Lease expiration failed");
  process.exitCode = 1;
});
