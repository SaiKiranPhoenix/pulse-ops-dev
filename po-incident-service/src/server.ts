import { createLogger } from "@pulseops/shared";
import { createApp } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { IncidentEvaluationConsumerService } from "./events/consumers/incident-evaluation.consumer.js";
import { createIncidentUpdatePublisher } from "./events/publishers/realtime-incident.publisher.js";
import { createIncidentServiceDependencies } from "./services/dependencies.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);

const incidentUpdatePublisher = createIncidentUpdatePublisher(env.RABBITMQ_URL);
const dependencies = createIncidentServiceDependencies({ incidentUpdatePublisher });
const incidentEvaluationConsumer = new IncidentEvaluationConsumerService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.INCIDENT_WORKER_PREFETCH,
  },
  dependencies.incidentService,
);

await incidentEvaluationConsumer.start();

const server = createApp({ dependencies }).listen(env.PORT, () => {
  logger.info("Incident service started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    incidentWorkerPrefetch: env.INCIDENT_WORKER_PREFETCH,
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Incident service shutting down", { signal });
  server.close(async () => {
    await incidentEvaluationConsumer.close();
    await incidentUpdatePublisher.close();
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
