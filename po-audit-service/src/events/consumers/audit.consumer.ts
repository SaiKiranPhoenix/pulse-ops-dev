import {
  AUDIT_EXCHANGE,
  AUDIT_QUEUE,
  AUDIT_VAULT_ROUTING_KEY,
  RabbitJsonConsumer,
} from "@pulseops/shared";
import type { AuditService } from "../../services/audit.service.js";

export class AuditConsumerService {
  private readonly consumer: RabbitJsonConsumer;

  constructor(
    options: { readonly rabbitMqUrl: string; readonly prefetch: number },
    private readonly audit: AuditService,
  ) {
    this.consumer = new RabbitJsonConsumer({
      url: options.rabbitMqUrl,
      exchange: AUDIT_EXCHANGE,
      queue: AUDIT_QUEUE,
      bindings: [
        {
          exchange: AUDIT_EXCHANGE,
          queue: AUDIT_QUEUE,
          routingKey: AUDIT_VAULT_ROUTING_KEY,
        },
      ],
      prefetch: options.prefetch,
    });
  }

  async start(): Promise<void> {
    await this.consumer.start(async (content) => {
      await this.audit.recordVaultEvent(content);
    });
  }

  async close(): Promise<void> {
    await this.consumer.close();
  }
}
