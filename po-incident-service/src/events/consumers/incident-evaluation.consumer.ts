import {
  INCIDENT_EVALUATION_QUEUE,
  INCIDENT_EVALUATION_ROUTING_KEY,
  INCIDENT_EXCHANGE,
  RabbitJsonConsumer,
  incidentEvaluationMessageSchema,
} from "@pulseops/shared";
import type { IncidentService } from "../../services/incident.service.js";

export type IncidentEvaluationConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class IncidentEvaluationConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: IncidentEvaluationConsumerOptions,
    private readonly incidents: IncidentService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: INCIDENT_EXCHANGE,
      queue: INCIDENT_EVALUATION_QUEUE,
      bindings: [
        {
          exchange: INCIDENT_EXCHANGE,
          queue: INCIDENT_EVALUATION_QUEUE,
          routingKey: INCIDENT_EVALUATION_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      const message = incidentEvaluationMessageSchema.parse(content);
      await this.incidents.evaluateError(message);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
