import {
  telemetryEventMessageSchema,
  type IncidentEvaluationMessage,
  type TelemetryEventMessage,
} from "@pulseops/shared";
import type { IncidentEvaluationPublisher } from "../events/publishers/incident-evaluation.publisher.js";
import type { EventRepository } from "../repositories/event.repository.js";

const noopIncidentEvaluationPublisher: IncidentEvaluationPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class EventWorkerService {
  constructor(
    private readonly events: EventRepository,
    private readonly incidentEvaluations: IncidentEvaluationPublisher = noopIncidentEvaluationPublisher,
  ) {}

  async process(content: unknown): Promise<void> {
    const message = telemetryEventMessageSchema.parse(content);
    const event = await this.events.createFromTelemetry(message);

    if (message.type === "error") {
      await this.incidentEvaluations.publish(toIncidentEvaluationMessage(message, event.id));
    }
  }
}

function toIncidentEvaluationMessage(
  message: TelemetryEventMessage,
  eventId: string,
): IncidentEvaluationMessage {
  return {
    evaluationId: `${message.messageId}:incident`,
    schemaVersion: 1,
    eventId,
    telemetryMessageId: message.messageId,
    projectId: message.projectId,
    ownerId: message.ownerId,
    correlationId: message.correlationId,
    source: message.source,
    level: message.level,
    message: message.message,
    fingerprint: message.fingerprint,
    observedAt: message.observedAt,
    receivedAt: message.acceptedAt,
    processedAt: new Date().toISOString(),
  };
}
