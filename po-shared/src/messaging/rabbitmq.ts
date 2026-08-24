import { Buffer } from "node:buffer";
import { connect, type ChannelModel, type ConfirmChannel, type ConsumeMessage } from "amqplib";
import { DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE } from "../contracts/queues/index.js";

export type RabbitQueueBinding = {
  readonly exchange: string;
  readonly routingKey: string;
  readonly queue: string;
};

export type RabbitPublisherOptions = {
  readonly url: string;
  readonly exchange: string;
  readonly exchangeType?: "direct" | "topic" | "fanout";
  readonly bindings?: readonly RabbitQueueBinding[];
};

export interface JsonMessagePublisher<TMessage> {
  publish(routingKey: string, message: TMessage): Promise<void>;
  close(): Promise<void>;
}

export class ConfirmRabbitJsonPublisher<TMessage> implements JsonMessagePublisher<TMessage> {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(private readonly options: RabbitPublisherOptions) {}

  async publish(routingKey: string, message: TMessage): Promise<void> {
    const channel = await this.getChannel();
    const payload = Buffer.from(JSON.stringify(message));

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        this.options.exchange,
        routingKey,
        payload,
        {
          contentType: "application/json",
          deliveryMode: 2,
          persistent: true,
          timestamp: Math.floor(Date.now() / 1000),
        },
        (error) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel !== null) {
      return this.channel;
    }

    this.connection = await connect(this.options.url);
    this.channel = await this.connection.createConfirmChannel();
    await assertDeadLetterTopology(this.channel);
    await this.channel.assertExchange(
      this.options.exchange,
      this.options.exchangeType ?? "direct",
      { durable: true },
    );

    for (const binding of this.options.bindings ?? []) {
      await this.channel.assertQueue(binding.queue, {
        durable: true,
        deadLetterExchange: DEAD_LETTER_EXCHANGE,
        deadLetterRoutingKey: "dead.telemetry",
      });
      await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
    }

    return this.channel;
  }
}

export type RabbitConsumerOptions = RabbitPublisherOptions & {
  readonly queue: string;
  readonly prefetch?: number;
};

export type JsonMessageHandler = (content: unknown, message: ConsumeMessage) => Promise<void>;

export class RabbitJsonConsumer {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(private readonly options: RabbitConsumerOptions) {}

  async start(handler: JsonMessageHandler): Promise<void> {
    this.connection = await connect(this.options.url);
    this.channel = await this.connection.createConfirmChannel();
    await assertDeadLetterTopology(this.channel);
    await this.channel.assertExchange(
      this.options.exchange,
      this.options.exchangeType ?? "direct",
      { durable: true },
    );

    for (const binding of this.options.bindings ?? []) {
      await this.channel.assertQueue(binding.queue, {
        durable: true,
        deadLetterExchange: DEAD_LETTER_EXCHANGE,
        deadLetterRoutingKey: "dead.telemetry",
      });
      await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
    }

    await this.channel.prefetch(this.options.prefetch ?? 10);
    await this.channel.consume(this.options.queue, (message) => {
      if (message === null) {
        return;
      }

      void this.handle(message, handler);
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private async handle(message: ConsumeMessage, handler: JsonMessageHandler): Promise<void> {
    if (this.channel === null) {
      return;
    }

    try {
      await handler(JSON.parse(message.content.toString("utf8")), message);
      this.channel.ack(message);
    } catch {
      this.channel.nack(message, false, false);
    }
  }
}

async function assertDeadLetterTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, "dead.telemetry");
}
