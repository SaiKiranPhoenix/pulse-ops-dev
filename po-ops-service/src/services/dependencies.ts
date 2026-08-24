import {
  closeRedisClient,
  connectRedisClient,
  createRedisClient,
  type PulseRedisClient,
} from "@pulseops/shared";
import { OpsController } from "../controllers/ops.controller.js";
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

  return createOpsServiceDependenciesFromRepositories({
    workerHealthRepository: new RedisWorkerHealthRepository(redis),
    queueStatusRepository: new RabbitQueueStatusRepository(options.rabbitMqUrl),
    close: async () => {
      await closeRedisClient(redis);
    },
  });
}

export function createOpsServiceDependenciesFromRepositories(options: {
  readonly workerHealthRepository: WorkerHealthRepository;
  readonly queueStatusRepository: QueueStatusRepository;
  readonly redis?: PulseRedisClient;
  close?(): Promise<void>;
}): OpsServiceDependencies {
  const opsService = new OpsService(options.workerHealthRepository, options.queueStatusRepository);

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
