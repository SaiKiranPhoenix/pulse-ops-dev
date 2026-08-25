import {
  REALTIME_EVENT_CREATED_QUEUE,
  REALTIME_EVENT_CREATED_ROUTING_KEY,
  REALTIME_EXCHANGE,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { RealtimeEventService } from "../../services/realtime-event.service.js";

export type RealtimeTelemetryEventConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class RealtimeTelemetryEventConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: RealtimeTelemetryEventConsumerOptions,
    private readonly realtimeEvents: RealtimeEventService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      queue: REALTIME_EVENT_CREATED_QUEUE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_EVENT_CREATED_QUEUE,
          routingKey: REALTIME_EVENT_CREATED_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      this.realtimeEvents.emitEventCreated(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
