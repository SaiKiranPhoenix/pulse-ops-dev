import {
  ConfirmRabbitJsonPublisher,
  REALTIME_EXCHANGE,
  REALTIME_WORKER_HEARTBEAT_QUEUE,
  REALTIME_WORKER_HEARTBEAT_ROUTING_KEY,
  type JsonMessagePublisher,
  type RealtimeWorkerHeartbeatMessage,
} from "@pulseops/shared";

export interface RealtimeWorkerHeartbeatPublisher {
  publish(message: RealtimeWorkerHeartbeatMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopRealtimeWorkerHeartbeatPublisher: RealtimeWorkerHeartbeatPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitRealtimeWorkerHeartbeatPublisher implements RealtimeWorkerHeartbeatPublisher {
  private readonly publisher: JsonMessagePublisher<RealtimeWorkerHeartbeatMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<RealtimeWorkerHeartbeatMessage>({
      url: rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_WORKER_HEARTBEAT_QUEUE,
          routingKey: REALTIME_WORKER_HEARTBEAT_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: RealtimeWorkerHeartbeatMessage): Promise<void> {
    await this.publisher.publish(REALTIME_WORKER_HEARTBEAT_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createRealtimeWorkerHeartbeatPublisher(
  rabbitMqUrl: string,
): RealtimeWorkerHeartbeatPublisher {
  return new RabbitRealtimeWorkerHeartbeatPublisher(rabbitMqUrl);
}
