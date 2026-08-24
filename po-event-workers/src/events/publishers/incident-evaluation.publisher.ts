import {
  ConfirmRabbitJsonPublisher,
  INCIDENT_EVALUATION_QUEUE,
  INCIDENT_EVALUATION_ROUTING_KEY,
  INCIDENT_EXCHANGE,
  type IncidentEvaluationMessage,
  type JsonMessagePublisher,
} from "@pulseops/shared";

export interface IncidentEvaluationPublisher {
  publish(message: IncidentEvaluationMessage): Promise<void>;
  close(): Promise<void>;
}

export class RabbitIncidentEvaluationPublisher implements IncidentEvaluationPublisher {
  private readonly publisher: JsonMessagePublisher<IncidentEvaluationMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<IncidentEvaluationMessage>({
      url: rabbitMqUrl,
      exchange: INCIDENT_EXCHANGE,
      bindings: [
        {
          exchange: INCIDENT_EXCHANGE,
          queue: INCIDENT_EVALUATION_QUEUE,
          routingKey: INCIDENT_EVALUATION_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: IncidentEvaluationMessage): Promise<void> {
    await this.publisher.publish(INCIDENT_EVALUATION_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createIncidentEvaluationPublisher(
  rabbitMqUrl: string,
): IncidentEvaluationPublisher {
  return new RabbitIncidentEvaluationPublisher(rabbitMqUrl);
}
