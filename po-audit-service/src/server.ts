import { createLogger } from "@pulseops/shared";
import { createApp } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { AuditConsumerService } from "./events/consumers/audit.consumer.js";
import { RabbitRealtimeVaultAuditPublisher } from "./events/publishers/realtime-vault-audit.publisher.js";
import { createAuditServiceDependencies } from "./services/dependencies.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);

const realtimeVaultAuditPublisher = new RabbitRealtimeVaultAuditPublisher(env.RABBITMQ_URL);
const dependencies = createAuditServiceDependencies(realtimeVaultAuditPublisher);
const consumer = new AuditConsumerService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.AUDIT_WORKER_PREFETCH,
  },
  dependencies.auditService,
);

await consumer.start();

const server = createApp({ dependencies }).listen(env.PORT, () => {
  logger.info("Audit service started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    auditWorkerPrefetch: env.AUDIT_WORKER_PREFETCH,
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Audit service shutting down", { signal });
  server.close(async () => {
    await consumer.close();
    await realtimeVaultAuditPublisher.close();
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
