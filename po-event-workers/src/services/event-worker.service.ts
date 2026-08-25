import {
  telemetryEventMessageSchema,
  type IncidentEvaluationMessage,
  type RealtimeEventCreatedMessage,
  type TelemetryEventMessage,
} from "@pulseops/shared";
import type { IncidentEvaluationPublisher } from "../events/publishers/incident-evaluation.publisher.js";
import {
  noopRealtimeEventPublisher,
  type RealtimeEventPublisher,
} from "../events/publishers/realtime-event.publisher.js";
import type { EventRepository } from "../repositories/event.repository.js";

const noopIncidentEvaluationPublisher: IncidentEvaluationPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class EventWorkerService {
  constructor(
    private readonly events: EventRepository,
    private readonly incidentEvaluations: IncidentEvaluationPublisher = noopIncidentEvaluationPublisher,
    private readonly realtimeEvents: RealtimeEventPublisher = noopRealtimeEventPublisher,
  ) {}

  async process(content: unknown): Promise<void> {
    const message = telemetryEventMessageSchema.parse(content);
    const event = await this.events.createFromTelemetry(message);

    if (event.wasCreated) {
      await this.realtimeEvents.publish(toRealtimeEventCreatedMessage(message, event.id));
    }

    if (message.type === "error") {
      await this.incidentEvaluations.publish(toIncidentEvaluationMessage(message, event.id));
    }
  }
}

function toRealtimeEventCreatedMessage(
  message: TelemetryEventMessage,
  eventId: string,
): RealtimeEventCreatedMessage {
  return {
    messageId: `${message.messageId}:event-created`,
    schemaVersion: 1,
    projectId: message.projectId,
    event: {
      id: eventId,
      projectId: message.projectId,
      type: message.type,
      source: message.source,
      level: message.level,
      message: message.message,
      name: message.name,
      value: message.value,
      fingerprint: message.fingerprint,
      attributes: message.attributes,
      observedAt: message.observedAt,
      receivedAt: message.acceptedAt,
    },
    occurredAt: new Date().toISOString(),
  };
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
