import {
  ConfirmRabbitJsonPublisher,
  TELEMETRY_EXCHANGE,
  TELEMETRY_QUEUES,
  TELEMETRY_ROUTING_KEYS,
  type JsonMessagePublisher,
  type TelemetryEventMessage,
  type TelemetryEventType,
} from "@pulseops/shared";

export type TelemetryMessagePublisher = JsonMessagePublisher<TelemetryEventMessage>;

const telemetryTypes: readonly TelemetryEventType[] = ["log", "error", "metric"];

export function createTelemetryMessagePublisher(rabbitMqUrl: string): TelemetryMessagePublisher {
  return new ConfirmRabbitJsonPublisher<TelemetryEventMessage>({
    url: rabbitMqUrl,
    exchange: TELEMETRY_EXCHANGE,
    bindings: telemetryTypes.map((type) => ({
      exchange: TELEMETRY_EXCHANGE,
      queue: TELEMETRY_QUEUES[type],
      routingKey: TELEMETRY_ROUTING_KEYS[type],
    })),
  });
}
