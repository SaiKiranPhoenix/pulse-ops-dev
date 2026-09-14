import { hostname } from "node:os";
import {
  closeRedisClient,
  connectRedisClient,
  createLogger,
  createRedisClient,
} from "@pulseops/shared";
import { createHealthServer, type EventWorkerHealthStatus } from "./app.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { loadEnv } from "./config/env.js";
import { createIncidentEvaluationPublisher } from "./events/publishers/incident-evaluation.publisher.js";
import { createRealtimeEventPublisher } from "./events/publishers/realtime-event.publisher.js";
import { createRealtimeWorkerHeartbeatPublisher } from "./events/publishers/realtime-worker-heartbeat.publisher.js";
import { MongoEventRepository } from "./repositories/event.repository.js";
import { RedisWorkerHeartbeatRepository } from "./repositories/worker-heartbeat.repository.js";
import { EventWorkerService } from "./services/event-worker.service.js";
import { WorkerHeartbeatService } from "./services/worker-heartbeat.service.js";
import { WorkerRuntimeService } from "./services/worker-runtime.service.js";

const logger = createLogger({ service: SERVICE_NAME });
const env = loadEnv();
const startedAt = new Date();
let healthStatus: EventWorkerHealthStatus = "starting";

await connectMongo(env.MONGODB_URI);
const redis = await connectRedisClient(createRedisClient(env.REDIS_URL));

const incidentEvaluationPublisher = createIncidentEvaluationPublisher(env.RABBITMQ_URL);
const realtimeEventPublisher = createRealtimeEventPublisher(env.RABBITMQ_URL);
const realtimeWorkerHeartbeatPublisher = createRealtimeWorkerHeartbeatPublisher(env.RABBITMQ_URL);
const workerId = env.WORKER_ID ?? `${SERVICE_NAME}:${hostname()}:${process.pid}`;
const eventWorker = new EventWorkerService(
  new MongoEventRepository(),
  incidentEvaluationPublisher,
  realtimeEventPublisher,
);
const workerHeartbeat = new WorkerHeartbeatService(
  new RedisWorkerHeartbeatRepository(redis),
  {
    workerId,
    intervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
    ttlSeconds: env.WORKER_HEARTBEAT_TTL_SECONDS,
    processingStats: () => eventWorker.snapshotStats(),
  },
  realtimeWorkerHeartbeatPublisher,
);
const runtime = new WorkerRuntimeService(
  {
    rabbitMqUrl: env.RABBITMQ_URL,
    prefetch: env.WORKER_PREFETCH,
  },
  eventWorker,
);

await runtime.start();
await workerHeartbeat.start();
healthStatus = "ok";

const healthServer = createHealthServer(() => ({
  status: healthStatus,
  service: SERVICE_NAME,
  workerId,
  startedAt: startedAt.toISOString(),
  uptimeSeconds: Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1_000)),
  metrics: eventWorker.snapshotStats(),
}));
healthServer.listen(env.PORT, () => {
  logger.info("Event worker health endpoint started", {
    port: env.PORT,
  });
});

logger.info("Event workers started", {
  nodeEnv: env.NODE_ENV,
  prefetch: env.WORKER_PREFETCH,
  heartbeatIntervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  healthStatus = "stopping";
  logger.info("Event workers shutting down", { signal });
  workerHeartbeat.stop();
  await runtime.close();
  await incidentEvaluationPublisher.close();
  await realtimeEventPublisher.close();
  await realtimeWorkerHeartbeatPublisher.close();
  await closeRedisClient(redis);
  await disconnectMongo();
  healthServer.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
