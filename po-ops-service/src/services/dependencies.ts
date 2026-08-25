import {
  closeRedisClient,
  connectRedisClient,
  createRedisClient,
  type PulseRedisClient,
} from "@pulseops/shared";
import { OpsController } from "../controllers/ops.controller.js";
import {
  createRealtimeQueueStatusPublisher,
  type RealtimeQueueStatusPublisher,
} from "../events/publishers/realtime-queue-status.publisher.js";
import {
  RabbitQueueStatusRepository,
  type QueueStatusRepository,
} from "../repositories/queue-status.repository.js";
import {
  RedisWorkerHealthRepository,
  type WorkerHealthRepository,
} from "../repositories/worker-health.repository.js";
import { OpsService } from "./ops.service.js";

export type OpsServiceDependencies = {
  readonly opsController: OpsController;
  readonly opsService: OpsService;
  close(): Promise<void>;
};

export type CreateOpsServiceDependenciesOptions = {
  readonly redisUrl: string;
  readonly rabbitMqUrl: string;
};

export async function createOpsServiceDependencies(
  options: CreateOpsServiceDependenciesOptions,
): Promise<OpsServiceDependencies> {
  const redis = await connectRedisClient(createRedisClient(options.redisUrl));
  const realtimeQueueStatusPublisher = createRealtimeQueueStatusPublisher(options.rabbitMqUrl);

  return createOpsServiceDependenciesFromRepositories({
    workerHealthRepository: new RedisWorkerHealthRepository(redis),
    queueStatusRepository: new RabbitQueueStatusRepository(options.rabbitMqUrl),
    realtimeQueueStatusPublisher,
    close: async () => {
      await realtimeQueueStatusPublisher.close();
      await closeRedisClient(redis);
    },
  });
}

export function createOpsServiceDependenciesFromRepositories(options: {
  readonly workerHealthRepository: WorkerHealthRepository;
  readonly queueStatusRepository: QueueStatusRepository;
  readonly realtimeQueueStatusPublisher?: RealtimeQueueStatusPublisher;
  readonly redis?: PulseRedisClient;
  close?(): Promise<void>;
}): OpsServiceDependencies {
  const opsService = new OpsService(
    options.workerHealthRepository,
    options.queueStatusRepository,
    options.realtimeQueueStatusPublisher,
  );

  return {
    opsController: new OpsController(opsService),
    opsService,
    async close(): Promise<void> {
      await options.close?.();
      if (options.redis !== undefined) {
        await closeRedisClient(options.redis);
      }
    },
  };
}
