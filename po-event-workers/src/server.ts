import { createLogger } from "@pulseops/shared";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { createIncidentEvaluationPublisher } from "./events/publishers/incident-evaluation.publisher.js";
import { MongoEventRepository } from "./repositories/event.repository.js";
import { EventWorkerService } from "./services/event-worker.service.js";
import { WorkerRuntimeService } from "./services/worker-runtime.service.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);

const incidentEvaluationPublisher = createIncidentEvaluationPublisher(env.RABBITMQ_URL);
const runtime = new WorkerRuntimeService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.WORKER_PREFETCH,
  },
  new EventWorkerService(new MongoEventRepository(), incidentEvaluationPublisher),
);

await runtime.start();

logger.info("Event workers started", {
  nodeEnv: env.NODE_ENV,
  prefetch: env.WORKER_PREFETCH,
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Event workers shutting down", { signal });
  await runtime.close();
  await incidentEvaluationPublisher.close();
  await disconnectMongo();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
