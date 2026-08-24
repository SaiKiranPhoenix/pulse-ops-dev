import { createLogger } from "@pulseops/shared";
import { createRealtimeGateway } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv, parseAllowedOrigins } from "./config/env.js";
import { RealtimeIncidentConsumerService } from "./events/consumers/realtime-incident.consumer.js";
import { MongoProjectAuthorizationRepository } from "./repositories/project-authorization.repository.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);

const gateway = createRealtimeGateway({
  jwtSecret: env.JWT_SECRET,
  allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
  projectAuthorization: new MongoProjectAuthorizationRepository(),
});
const incidentConsumer = new RealtimeIncidentConsumerService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.REALTIME_WORKER_PREFETCH,
  },
  gateway.realtimeEvents,
);

await incidentConsumer.start();

gateway.httpServer.listen(env.PORT, () => {
  logger.info("Realtime gateway started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    realtimeWorkerPrefetch: env.REALTIME_WORKER_PREFETCH,
  });
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Realtime gateway shutting down", { signal });
  await incidentConsumer.close();
  await gateway.close();
  await disconnectMongo();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
