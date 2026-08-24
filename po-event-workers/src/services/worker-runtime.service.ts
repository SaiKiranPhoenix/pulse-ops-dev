import {
  RabbitJsonConsumer,
  TELEMETRY_EXCHANGE,
  TELEMETRY_QUEUES,
  TELEMETRY_ROUTING_KEYS,
  type TelemetryEventType,
} from "@pulseops/shared";
import type { EventWorkerService } from "./event-worker.service.js";

export type WorkerRuntimeOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class WorkerRuntimeService {
  private readonly consumers: RabbitJsonConsumer[];

  constructor(
    options: WorkerRuntimeOptions,
    private readonly eventWorker: EventWorkerService,
  ) {
    const telemetryTypes: readonly TelemetryEventType[] = ["log", "error", "metric"];
    const bindings = telemetryTypes.map((type) => ({
      exchange: TELEMETRY_EXCHANGE,
      queue: TELEMETRY_QUEUES[type],
      routingKey: TELEMETRY_ROUTING_KEYS[type],
    }));

    this.consumers = telemetryTypes.map(
      (type) =>
        new RabbitJsonConsumer({
          url: options.rabbitMqUrl,
          exchange: TELEMETRY_EXCHANGE,
          queue: TELEMETRY_QUEUES[type],
          bindings,
          prefetch: options.prefetch,
        }),
    );
  }

  async start(): Promise<void> {
    await Promise.all(
      this.consumers.map((consumer) =>
        consumer.start((content) => this.eventWorker.process(content)),
      ),
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.close()));
  }
}
