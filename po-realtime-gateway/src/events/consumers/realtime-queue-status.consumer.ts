import {
  REALTIME_EXCHANGE,
  REALTIME_QUEUE_STATUS_QUEUE,
  REALTIME_QUEUE_STATUS_ROUTING_KEY,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { RealtimeEventService } from "../../services/realtime-event.service.js";

export type RealtimeQueueStatusConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class RealtimeQueueStatusConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: RealtimeQueueStatusConsumerOptions,
    private readonly realtimeEvents: RealtimeEventService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      queue: REALTIME_QUEUE_STATUS_QUEUE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_QUEUE_STATUS_QUEUE,
          routingKey: REALTIME_QUEUE_STATUS_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      this.realtimeEvents.emitQueueStatus(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
