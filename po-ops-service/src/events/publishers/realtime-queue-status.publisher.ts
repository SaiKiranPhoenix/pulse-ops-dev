import {
  ConfirmRabbitJsonPublisher,
  REALTIME_EXCHANGE,
  REALTIME_QUEUE_STATUS_QUEUE,
  REALTIME_QUEUE_STATUS_ROUTING_KEY,
  type JsonMessagePublisher,
  type RealtimeQueueStatusMessage,
} from "@pulseops/shared";

export interface RealtimeQueueStatusPublisher {
  publish(message: RealtimeQueueStatusMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopRealtimeQueueStatusPublisher: RealtimeQueueStatusPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitRealtimeQueueStatusPublisher implements RealtimeQueueStatusPublisher {
  private readonly publisher: JsonMessagePublisher<RealtimeQueueStatusMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<RealtimeQueueStatusMessage>({
      url: rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_QUEUE_STATUS_QUEUE,
          routingKey: REALTIME_QUEUE_STATUS_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: RealtimeQueueStatusMessage): Promise<void> {
    await this.publisher.publish(REALTIME_QUEUE_STATUS_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createRealtimeQueueStatusPublisher(
  rabbitMqUrl: string,
): RealtimeQueueStatusPublisher {
  return new RabbitRealtimeQueueStatusPublisher(rabbitMqUrl);
}
