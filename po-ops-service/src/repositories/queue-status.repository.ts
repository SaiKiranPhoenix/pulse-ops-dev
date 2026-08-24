import { RabbitQueueInspector, type RabbitQueueSnapshot } from "@pulseops/shared";
import { OBSERVED_QUEUE_NAMES } from "../config/constants.js";

export type QueueStatusRecord = RabbitQueueSnapshot;

export interface QueueStatusRepository {
  inspect(): Promise<QueueStatusRecord[]>;
}

export class RabbitQueueStatusRepository implements QueueStatusRepository {
  private readonly inspector: RabbitQueueInspector;

  constructor(rabbitMqUrl: string) {
    this.inspector = new RabbitQueueInspector(rabbitMqUrl);
  }

  async inspect(): Promise<QueueStatusRecord[]> {
    return this.inspector.inspect(OBSERVED_QUEUE_NAMES);
  }
}
