import { createLogger } from "@pulseops/shared";
import { createApp } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);

const app = createApp();
const closeDependencies = app.locals?.closeDependencies as (() => Promise<void>) | undefined;

const server = app.listen(env.PORT, () => {
  logger.info("Auth project service started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Auth project service shutting down", { signal });
  server.close(async () => {
    await closeDependencies?.();
    await disconnectMongo();
    process.exit(0);
  });
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
