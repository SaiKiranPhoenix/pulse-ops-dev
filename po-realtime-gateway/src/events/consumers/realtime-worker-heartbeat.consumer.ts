import {
  REALTIME_EXCHANGE,
  REALTIME_WORKER_HEARTBEAT_QUEUE,
  REALTIME_WORKER_HEARTBEAT_ROUTING_KEY,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { RealtimeEventService } from "../../services/realtime-event.service.js";

export type RealtimeWorkerHeartbeatConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class RealtimeWorkerHeartbeatConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: RealtimeWorkerHeartbeatConsumerOptions,
    private readonly realtimeEvents: RealtimeEventService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      queue: REALTIME_WORKER_HEARTBEAT_QUEUE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_WORKER_HEARTBEAT_QUEUE,
          routingKey: REALTIME_WORKER_HEARTBEAT_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      this.realtimeEvents.emitWorkerHeartbeat(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
