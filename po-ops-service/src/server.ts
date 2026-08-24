import { createLogger } from "@pulseops/shared";
import { createApp } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { loadEnv } from "./config/env.js";
import { createOpsServiceDependencies } from "./services/dependencies.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();
const dependencies = await createOpsServiceDependencies({
  redisUrl: env.REDIS_URL,
  rabbitMqUrl: env.RABBITMQ_URL,
});

const server = createApp({ dependencies }).listen(env.PORT, () => {
  logger.info("Ops service started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Ops service shutting down", { signal });
  server.close(async () => {
    await dependencies.close();
    process.exit(0);
  });
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
