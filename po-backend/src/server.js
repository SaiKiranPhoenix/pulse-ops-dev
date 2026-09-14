import { createServer } from "node:http";
import { hostname } from "node:os";
import process from "node:process";
import express from "express";
import mongoose from "mongoose";
import {
  closeRedisClient,
  connectRedisClient,
  createLogger,
  createRedisClient,
} from "@pulseops/shared";
import { createApp as createGatewayApp } from "../../po-api-gateway/src/app.ts";
import { GATEWAY_LIMITS } from "../../po-api-gateway/src/config/constants.ts";
import { createCorsMiddleware } from "../../po-api-gateway/src/middlewares/cors.middleware.ts";
import { createErrorMiddleware } from "../../po-api-gateway/src/middlewares/error.middleware.ts";
import { createAuthMiddleware as createGatewayAuthMiddleware } from "../../po-api-gateway/src/middlewares/auth.middleware.ts";
import { createProjectAccessMiddleware } from "../../po-api-gateway/src/middlewares/project-access.middleware.ts";
import { createRequestLoggingMiddleware } from "../../po-api-gateway/src/middlewares/request-logging.middleware.ts";
import { createApiGatewayDependencies } from "../../po-api-gateway/src/services/dependencies.ts";
import { createApp as createAuthProjectApp } from "../../po-auth-project-service/src/app.ts";
import { createApp as createIngestionApp } from "../../po-ingestion-service/src/app.ts";
import { createApp as createIncidentApp } from "../../po-incident-service/src/app.ts";
import { createApp as createOpsApp } from "../../po-ops-service/src/app.ts";
import { createApp as createVaultApp } from "../../po-vault-service/src/app.ts";
import { createApp as createAuditApp } from "../../po-audit-service/src/app.ts";
import { createIncidentEvaluationPublisher } from "../../po-event-workers/src/events/publishers/incident-evaluation.publisher.ts";
import { createRealtimeEventPublisher } from "../../po-event-workers/src/events/publishers/realtime-event.publisher.ts";
import { createRealtimeWorkerHeartbeatPublisher } from "../../po-event-workers/src/events/publishers/realtime-worker-heartbeat.publisher.ts";
import { MongoEventRepository } from "../../po-event-workers/src/repositories/event.repository.ts";
import { RedisWorkerHeartbeatRepository } from "../../po-event-workers/src/repositories/worker-heartbeat.repository.ts";
import { EventWorkerService } from "../../po-event-workers/src/services/event-worker.service.ts";
import { WorkerHeartbeatService } from "../../po-event-workers/src/services/worker-heartbeat.service.ts";
import { WorkerRuntimeService } from "../../po-event-workers/src/services/worker-runtime.service.ts";
import { IncidentEvaluationConsumerService } from "../../po-incident-service/src/events/consumers/incident-evaluation.consumer.ts";
import { createIncidentUpdatePublisher } from "../../po-incident-service/src/events/publishers/realtime-incident.publisher.ts";
import { createIncidentServiceDependencies } from "../../po-incident-service/src/services/dependencies.ts";
import { AuditConsumerService } from "../../po-audit-service/src/events/consumers/audit.consumer.ts";
import { RabbitRealtimeVaultAuditPublisher } from "../../po-audit-service/src/events/publishers/realtime-vault-audit.publisher.ts";
import { createAuditServiceDependencies } from "../../po-audit-service/src/services/dependencies.ts";
import { attachRealtimeGateway } from "../../po-realtime-gateway/src/app.ts";
import { RealtimeIncidentConsumerService } from "../../po-realtime-gateway/src/events/consumers/realtime-incident.consumer.ts";
import { RealtimeTelemetryEventConsumerService } from "../../po-realtime-gateway/src/events/consumers/realtime-event.consumer.ts";
import { RealtimeQueueStatusConsumerService } from "../../po-realtime-gateway/src/events/consumers/realtime-queue-status.consumer.ts";
import { RealtimeVaultAuditConsumerService } from "../../po-realtime-gateway/src/events/consumers/realtime-vault-audit.consumer.ts";
import { RealtimeWorkerHeartbeatConsumerService } from "../../po-realtime-gateway/src/events/consumers/realtime-worker-heartbeat.consumer.ts";
import { MongoProjectAuthorizationRepository } from "../../po-realtime-gateway/src/repositories/project-authorization.repository.ts";
import { loadMonolithEnv, parseAllowedOrigins } from "./config.js";

const serviceName = "po-backend";
const logger = createLogger({ service: serviceName });
const env = loadMonolithEnv();
const startedAt = new Date();
const workerClosers = [];
let isShuttingDown = false;

await mongoose.connect(env.MONGODB_URI, {
  autoIndex: true,
  serverSelectionTimeoutMS: 5_000,
});

const redis = await connectRedisClient(createRedisClient(env.REDIS_URL));
workerClosers.push(() => closeRedisClient(redis));

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use(createCorsMiddleware(env.CORS_ALLOWED_ORIGINS));
app.use(createRequestLoggingMiddleware(logger));
app.use(express.json({ limit: GATEWAY_LIMITS.bodyLimit }));
app.get("/health", (_request, response) => {
  response.status(200).json({
    status: isShuttingDown ? "stopping" : "ok",
    service: serviceName,
    mode: "monolith",
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1_000)),
  });
});
app.get("/health/services", (_request, response) => {
  response.status(200).json({
    status: isShuttingDown ? "stopping" : "ok",
    mode: "monolith",
    modules: [
      "api-gateway",
      "auth-project",
      "ingestion",
      "event-workers",
      "incident",
      "ops",
      "vault",
      "audit",
      "realtime",
    ].map((name) => ({ name, status: "in-process" })),
  });
});

const realtimeGateway = attachRealtimeGateway(app, httpServer, {
  jwtSecret: env.JWT_SECRET,
  allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
  projectAuthorization: new MongoProjectAuthorizationRepository(),
});
workerClosers.push(() => realtimeGateway.close());

const backgroundWorkers = await startBackgroundWorkers(realtimeGateway);
const gatewayDependencies = createApiGatewayDependencies();
const requireGatewayAuth = createGatewayAuthMiddleware(gatewayDependencies.jwtSecret);
const requireProjectAccess = createProjectAccessMiddleware(
  gatewayDependencies.projectAuthorization,
);

app.use(
  [
    "/audit",
    "/custom-dashboards",
    "/explorer",
    "/infra",
    "/incidents",
    "/log-pipelines",
    "/logs",
    "/maintenance-windows",
    "/metrics",
    "/monitors",
    "/notification-channels",
    "/notification-routing",
    "/on-call",
    "/rum",
    "/silence-windows",
    "/slos",
    "/uptime",
    "/vault",
  ],
  requireGatewayAuth,
  requireProjectAccess,
);

const serviceApps = [
  createAuthProjectApp(),
  createIngestionApp(),
  createIncidentApp({ dependencies: backgroundWorkers.incidentDependencies }),
  createOpsApp(),
  createVaultApp(),
  createAuditApp({ dependencies: backgroundWorkers.auditDependencies }),
  createGatewayApp({ dependencies: gatewayDependencies }),
];

for (const serviceApp of serviceApps) {
  const closeDependencies = serviceApp.locals.closeDependencies;

  if (typeof closeDependencies === "function") {
    workerClosers.push(() => closeDependencies());
  }

  app.use(serviceApp);
}

app.use(createErrorMiddleware(logger));

httpServer.listen(env.PORT, () => {
  logger.info("PulseOps monolith backend started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    modules: "api, workers, audit, realtime",
  });
});

async function startBackgroundWorkers(realtimeGateway) {
  const incidentEvaluationPublisher = createIncidentEvaluationPublisher(env.RABBITMQ_URL);
  const realtimeEventPublisher = createRealtimeEventPublisher(env.RABBITMQ_URL);
  const realtimeWorkerHeartbeatPublisher = createRealtimeWorkerHeartbeatPublisher(env.RABBITMQ_URL);
  const eventWorker = new EventWorkerService(
    new MongoEventRepository(),
    incidentEvaluationPublisher,
    realtimeEventPublisher,
  );
  const workerHeartbeat = new WorkerHeartbeatService(
    new RedisWorkerHeartbeatRepository(redis),
    {
      workerId: env.WORKER_ID ?? `po-event-workers:${hostname()}:${process.pid}`,
      intervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
      ttlSeconds: env.WORKER_HEARTBEAT_TTL_SECONDS,
      processingStats: () => eventWorker.snapshotStats(),
    },
    realtimeWorkerHeartbeatPublisher,
  );
  const eventRuntime = new WorkerRuntimeService(
    {
      rabbitMqUrl: env.RABBITMQ_URL,
      prefetch: env.WORKER_PREFETCH,
    },
    eventWorker,
  );

  const incidentUpdatePublisher = createIncidentUpdatePublisher(env.RABBITMQ_URL);
  const incidentDependencies = createIncidentServiceDependencies({ incidentUpdatePublisher });
  const incidentConsumer = new IncidentEvaluationConsumerService(
    {
      rabbitMqUrl: env.RABBITMQ_URL,
      prefetch: env.INCIDENT_WORKER_PREFETCH,
    },
    incidentDependencies.incidentService,
  );

  const realtimeVaultAuditPublisher = new RabbitRealtimeVaultAuditPublisher(env.RABBITMQ_URL);
  const auditDependencies = createAuditServiceDependencies(realtimeVaultAuditPublisher);
  const auditConsumer = new AuditConsumerService(
    {
      rabbitMqUrl: env.RABBITMQ_URL,
      prefetch: env.AUDIT_WORKER_PREFETCH,
    },
    auditDependencies.auditService,
  );

  const realtimeConsumers = [
    new RealtimeIncidentConsumerService(
      { rabbitMqUrl: env.RABBITMQ_URL, prefetch: env.REALTIME_WORKER_PREFETCH },
      realtimeGateway.realtimeEvents,
    ),
    new RealtimeTelemetryEventConsumerService(
      { rabbitMqUrl: env.RABBITMQ_URL, prefetch: env.REALTIME_WORKER_PREFETCH },
      realtimeGateway.realtimeEvents,
    ),
    new RealtimeVaultAuditConsumerService(
      { rabbitMqUrl: env.RABBITMQ_URL, prefetch: env.REALTIME_WORKER_PREFETCH },
      realtimeGateway.realtimeEvents,
    ),
    new RealtimeWorkerHeartbeatConsumerService(
      { rabbitMqUrl: env.RABBITMQ_URL, prefetch: env.REALTIME_WORKER_PREFETCH },
      realtimeGateway.realtimeEvents,
    ),
    new RealtimeQueueStatusConsumerService(
      { rabbitMqUrl: env.RABBITMQ_URL, prefetch: env.REALTIME_WORKER_PREFETCH },
      realtimeGateway.realtimeEvents,
    ),
  ];

  await eventRuntime.start();
  await workerHeartbeat.start();
  await incidentConsumer.start();
  await auditConsumer.start();
  await Promise.all(realtimeConsumers.map((consumer) => consumer.start()));

  workerClosers.push(async () => {
    workerHeartbeat.stop();
    await eventRuntime.close();
    await incidentConsumer.close();
    await auditConsumer.close();
    await Promise.all(realtimeConsumers.map((consumer) => consumer.close()));
    await incidentEvaluationPublisher.close();
    await realtimeEventPublisher.close();
    await realtimeWorkerHeartbeatPublisher.close();
    await incidentUpdatePublisher.close();
    await realtimeVaultAuditPublisher.close();
  });

  return {
    incidentDependencies,
    auditDependencies,
  };
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info("PulseOps monolith backend shutting down", { signal });
  await new Promise((resolve) => httpServer.close(resolve));
  for (const close of workerClosers.reverse()) {
    await close();
  }
  await mongoose.disconnect();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
