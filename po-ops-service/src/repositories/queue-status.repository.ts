import {
  RabbitQueueInspector,
  type RabbitDeadLetterMessage,
  type RabbitDeadLetterReplayResult,
  type RabbitQueueSnapshot,
} from "@pulseops/shared";
import { OBSERVED_QUEUE_NAMES } from "../config/constants.js";

export type QueueStatusRecord = RabbitQueueSnapshot;

export interface QueueStatusRepository {
  inspect(): Promise<QueueStatusRecord[]>;
  inspectDeadLetters(limit: number): Promise<RabbitDeadLetterMessage[]>;
  replayDeadLetters(limit: number): Promise<RabbitDeadLetterReplayResult>;
}

export class RabbitQueueStatusRepository implements QueueStatusRepository {
  private readonly inspector: RabbitQueueInspector;

  constructor(rabbitMqUrl: string) {
    this.inspector = new RabbitQueueInspector(rabbitMqUrl);
  }

  async inspect(): Promise<QueueStatusRecord[]> {
    return this.inspector.inspect(OBSERVED_QUEUE_NAMES);
  }

  async inspectDeadLetters(limit: number): Promise<RabbitDeadLetterMessage[]> {
    return this.inspector.peekDeadLetters(limit);
  }

  async replayDeadLetters(limit: number): Promise<RabbitDeadLetterReplayResult> {
    return this.inspector.replayDeadLetters(limit);
  }
}
