import {
  REALTIME_EXCHANGE,
  REALTIME_INCIDENT_UPDATED_ROUTING_KEY,
  REALTIME_INCIDENT_UPDATES_QUEUE,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { RealtimeEventService } from "../../services/realtime-event.service.js";

export type RealtimeIncidentConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class RealtimeIncidentConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: RealtimeIncidentConsumerOptions,
    private readonly realtimeEvents: RealtimeEventService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      queue: REALTIME_INCIDENT_UPDATES_QUEUE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_INCIDENT_UPDATES_QUEUE,
          routingKey: REALTIME_INCIDENT_UPDATED_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      this.realtimeEvents.emitIncidentUpdate(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
