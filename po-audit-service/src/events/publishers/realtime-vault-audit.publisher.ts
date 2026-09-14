import {
  ConfirmRabbitJsonPublisher,
  REALTIME_EXCHANGE,
  REALTIME_VAULT_AUDIT_CREATED_QUEUE,
  REALTIME_VAULT_AUDIT_CREATED_ROUTING_KEY,
  type JsonMessagePublisher,
  type RealtimeVaultAuditCreatedMessage,
} from "@pulseops/shared";

export interface RealtimeVaultAuditPublisher {
  publish(message: RealtimeVaultAuditCreatedMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopRealtimeVaultAuditPublisher: RealtimeVaultAuditPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitRealtimeVaultAuditPublisher implements RealtimeVaultAuditPublisher {
  private readonly publisher: JsonMessagePublisher<RealtimeVaultAuditCreatedMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<RealtimeVaultAuditCreatedMessage>({
      url: rabbitMqUrl,
      exchange: REALTIME_EXCHANGE,
      bindings: [
        {
          exchange: REALTIME_EXCHANGE,
          queue: REALTIME_VAULT_AUDIT_CREATED_QUEUE,
          routingKey: REALTIME_VAULT_AUDIT_CREATED_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: RealtimeVaultAuditCreatedMessage): Promise<void> {
    await this.publisher.publish(REALTIME_VAULT_AUDIT_CREATED_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}
