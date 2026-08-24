import {
  ConfirmRabbitJsonPublisher,
  REALTIME_EXCHANGE,
  REALTIME_INCIDENT_UPDATED_ROUTING_KEY,
  REALTIME_INCIDENT_UPDATES_QUEUE,
  type JsonMessagePublisher,
  type RealtimeIncidentUpdateMessage,
} from "@pulseops/shared";

export interface IncidentUpdatePublisher {
  publish(message: RealtimeIncidentUpdateMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopIncidentUpdatePublisher: IncidentUpdatePublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitIncidentUpdatePublisher implements IncidentUpdatePublisher {
  private readonly publisher: JsonMessagePublisher<RealtimeIncidentUpdateMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<RealtimeIncidentUpdateMessage>({
      url: rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_INCIDENT_UPDATES_QUEUE,
          routingKey: REALTIME_INCIDENT_UPDATED_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: RealtimeIncidentUpdateMessage): Promise<void> {
    await this.publisher.publish(REALTIME_INCIDENT_UPDATED_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createIncidentUpdatePublisher(rabbitMqUrl: string): IncidentUpdatePublisher {
  return new RabbitIncidentUpdatePublisher(rabbitMqUrl);
}
