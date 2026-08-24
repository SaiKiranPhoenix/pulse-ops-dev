import {
  AUDIT_EXCHANGE,
  AUDIT_QUEUE,
  AUDIT_VAULT_ROUTING_KEY,
  ConfirmRabbitJsonPublisher,
  type JsonMessagePublisher,
  type VaultAuditEventMessage,
} from "@pulseops/shared";

export interface VaultAuditPublisher {
  publish(message: VaultAuditEventMessage): Promise<void>;
  close(): Promise<void>;
}

export const noopVaultAuditPublisher: VaultAuditPublisher = {
  async publish(): Promise<void> {},
  async close(): Promise<void> {},
};

export class RabbitVaultAuditPublisher implements VaultAuditPublisher {
  private readonly publisher: JsonMessagePublisher<VaultAuditEventMessage>;

  constructor(rabbitMqUrl: string) {
    this.publisher = new ConfirmRabbitJsonPublisher<VaultAuditEventMessage>({
      url: rabbitMqUrl,
      exchange: AUDIT_EXCHANGE,
      bindings: [
        {
          exchange: AUDIT_EXCHANGE,
          queue: AUDIT_QUEUE,
          routingKey: AUDIT_VAULT_ROUTING_KEY,
        },
      ],
    });
  }

  async publish(message: VaultAuditEventMessage): Promise<void> {
    await this.publisher.publish(AUDIT_VAULT_ROUTING_KEY, message);
  }

  async close(): Promise<void> {
    await this.publisher.close();
  }
}

export function createVaultAuditPublisher(rabbitMqUrl: string): VaultAuditPublisher {
  return new RabbitVaultAuditPublisher(rabbitMqUrl);
}
