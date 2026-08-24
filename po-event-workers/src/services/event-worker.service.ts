import { telemetryEventMessageSchema } from "@pulseops/shared";
import type { EventRepository } from "../repositories/event.repository.js";

export class EventWorkerService {
  constructor(private readonly events: EventRepository) {}

  async process(content: unknown): Promise<void> {
    const message = telemetryEventMessageSchema.parse(content);
    await this.events.createFromTelemetry(message);
  }
}
