import {
  REALTIME_EXCHANGE,
  REALTIME_VAULT_AUDIT_CREATED_QUEUE,
  REALTIME_VAULT_AUDIT_CREATED_ROUTING_KEY,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { RealtimeEventService } from "../../services/realtime-event.service.js";

export type RealtimeVaultAuditConsumerOptions = {
  readonly rabbitMqUrl: string;
  readonly prefetch: number;
};

export class RealtimeVaultAuditConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: RealtimeVaultAuditConsumerOptions,
    private readonly realtimeEvents: RealtimeEventService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      queue: REALTIME_VAULT_AUDIT_CREATED_QUEUE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_VAULT_AUDIT_CREATED_QUEUE,
          routingKey: REALTIME_VAULT_AUDIT_CREATED_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      this.realtimeEvents.emitVaultAuditCreated(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
