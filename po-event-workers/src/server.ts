import { hostname } from "node:os";
import {
  closeRedisClient,
  connectRedisClient,
  createLogger,
  createRedisClient,
} from "@pulseops/shared";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { createIncidentEvaluationPublisher } from "./events/publishers/incident-evaluation.publisher.js";
import { createRealtimeEventPublisher } from "./events/publishers/realtime-event.publisher.js";
import { MongoEventRepository } from "./repositories/event.repository.js";
import { RedisWorkerHeartbeatRepository } from "./repositories/worker-heartbeat.repository.js";
import { EventWorkerService } from "./services/event-worker.service.js";
import { WorkerHeartbeatService } from "./services/worker-heartbeat.service.js";
import { WorkerRuntimeService } from "./services/worker-runtime.service.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();

await connectMongo(env.MONGODB_URI);
const redis = await connectRedisClient(createRedisClient(env.REDIS_URL));

const incidentEvaluationPublisher = createIncidentEvaluationPublisher(env.RABBITMQ_URL);
const realtimeEventPublisher = createRealtimeEventPublisher(env.RABBITMQ_URL);
const workerHeartbeat = new WorkerHeartbeatService(new RedisWorkerHeartbeatRepository(redis), {
  workerId: env.WORKER_ID ?? `${SERVICE_NAME}:${hostname()}:${process.pid}`,
  intervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
  ttlSeconds: env.WORKER_HEARTBEAT_TTL_SECONDS,
});
const runtime = new WorkerRuntimeService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.WORKER_PREFETCH,
  },
  new EventWorkerService(
    new MongoEventRepository(),
    incidentEvaluationPublisher,
    realtimeEventPublisher,
  ),
);

await runtime.start();
await workerHeartbeat.start();

logger.info("Event workers started", {
  nodeEnv: env.NODE_ENV,
  prefetch: env.WORKER_PREFETCH,
  heartbeatIntervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info("Event workers shutting down", { signal });
  workerHeartbeat.stop();
  await runtime.close();
  await incidentEvaluationPublisher.close();
  await realtimeEventPublisher.close();
  await closeRedisClient(redis);
  await disconnectMongo();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
