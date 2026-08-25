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
  private readonly stats: WorkerProcessingStats = {
    processed: 0,
    processedByType: {
      log: 0,
      error: 0,
      metric: 0,
    },
    failed: 0,
    retries: 0,
    poisonMessages: 0,
    lastProcessedAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  };

  constructor(
    private readonly events: EventRepository,
    private readonly incidentEvaluations: IncidentEvaluationPublisher = noopIncidentEvaluationPublisher,
    private readonly realtimeEvents: RealtimeEventPublisher = noopRealtimeEventPublisher,
  ) {}

  async process(content: unknown, context: WorkerProcessContext = {}): Promise<void> {
    try {
      const message = telemetryEventMessageSchema.parse(content);
      const event = await this.events.createFromTelemetry(message);

      if (event.wasCreated) {
        await this.realtimeEvents.publish(toRealtimeEventCreatedMessage(message, event.id));
      }

      if (message.type === "error") {
        await this.incidentEvaluations.publish(toIncidentEvaluationMessage(message, event.id));
      }

      this.recordProcessed(message.type);
    } catch (error) {
      this.recordFailure(error, context.redelivered ?? false);
      throw error;
    }
  }

  snapshotStats(): WorkerProcessingStats {
    return {
      ...this.stats,
      processedByType: { ...this.stats.processedByType },
    };
  }

  private recordProcessed(type: TelemetryEventMessage["type"]): void {
    this.stats.processed += 1;
    this.stats.processedByType[type] += 1;
    this.stats.lastProcessedAt = new Date().toISOString();
  }

  private recordFailure(error: unknown, redelivered: boolean): void {
    this.stats.failed += 1;
    this.stats.poisonMessages += 1;
    this.stats.retries += redelivered ? 1 : 0;
    this.stats.lastErrorAt = new Date().toISOString();
    this.stats.lastErrorMessage = error instanceof Error ? error.message : "Unknown worker error";
  }
}

export type WorkerProcessContext = {
  readonly redelivered?: boolean;
};

export type WorkerProcessingStats = {
  processed: number;
  processedByType: Record<TelemetryEventMessage["type"], number>;
  failed: number;
  retries: number;
  poisonMessages: number;
  lastProcessedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

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
      unit: message.unit,
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
