import {
  ConfirmRabbitJsonPublisher,
  REALTIME_EVENT_CREATED_QUEUE,
  REALTIME_EVENT_CREATED_ROUTING_KEY,
  REALTIME_EXCHANGE,
  type JsonMessagePublisher,
  type RealtimeEventCreatedMessage,
} from "@pulseops/shared";

export interface RealtimeEventPublisher {
  publish(message: RealtimeEventCreatedMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopRealtimeEventPublisher: RealtimeEventPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitRealtimeEventPublisher implements RealtimeEventPublisher {
  private readonly publisher: JsonMessagePublisher<RealtimeEventCreatedMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<RealtimeEventCreatedMessage>({
      url: rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_EVENT_CREATED_QUEUE,
          routingKey: REALTIME_EVENT_CREATED_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: RealtimeEventCreatedMessage): Promise<void> {
    await this.publisher.publish(REALTIME_EVENT_CREATED_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createRealtimeEventPublisher(rabbitMqUrl: string): RealtimeEventPublisher {
  return new RabbitRealtimeEventPublisher(rabbitMqUrl);
}
