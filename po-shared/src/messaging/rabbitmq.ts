import { Buffer } from "node:buffer";
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
  type GetMessage,
  type Options,
} from "amqplib";
import { DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE } from "../contracts/queues/index.js";

export const RABBIT_RETRY_COUNT_HEADER = "x-pulseops-retry-count";
export const RABBIT_FAILURE_REASON_HEADER = "x-pulseops-failure-reason";
export const RABBIT_REPLAYED_AT_HEADER = "x-pulseops-replayed-at";
export const DEFAULT_RABBIT_MAX_RETRIES = 3;

export type RabbitQueueBinding = {
  readonly exchange: string;
  readonly routingKey: string;
  readonly queue: string;
};

export type RabbitQueueSnapshot = {
  readonly name: string;
  readonly status: "available" | "missing";
  readonly messageCount: number | null;
  readonly consumerCount: number | null;
};

export type RabbitDeadLetterMessage = {
  readonly id: string;
  readonly routingKey: string;
  readonly exchange: string;
  readonly redelivered: boolean;
  readonly contentType: string | undefined;
  readonly retryCount: number;
  readonly deadLetterReason: string | null;
  readonly failureReason: string | null;
  readonly originalExchange: string | null;
  readonly originalRoutingKey: string | null;
  readonly payload: unknown;
};

export type RabbitDeadLetterReplayResult = {
  readonly replayed: number;
};

type RabbitHeaders = Record<string, unknown>;

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

export class RabbitQueueInspector {
  constructor(private readonly url: string) {}

  async inspect(queueNames: readonly string[]): Promise<RabbitQueueSnapshot[]> {
    return Promise.all(queueNames.map((queueName) => this.inspectOne(queueName)));
  }

  async peekDeadLetters(limit: number): Promise<RabbitDeadLetterMessage[]> {
    const connection = await connect(this.url);
    const channel = await connection.createConfirmChannel();
    const messages: RabbitDeadLetterMessage[] = [];

    try {
      await assertDeadLetterTopology(channel);

      for (let index = 0; index < limit; index += 1) {
        const message = await channel.get(DEAD_LETTER_QUEUE, { noAck: false });

        if (message === false) {
          break;
        }

        messages.push(toDeadLetterMessage(message));
        channel.nack(message, false, true);
      }

      return messages;
    } finally {
      await closeRabbitResources(channel, connection);
    }
  }

  async replayDeadLetters(limit: number): Promise<RabbitDeadLetterReplayResult> {
    const connection = await connect(this.url);
    const channel = await connection.createConfirmChannel();
    let replayed = 0;

    try {
      await assertDeadLetterTopology(channel);

      for (let index = 0; index < limit; index += 1) {
        const message = await channel.get(DEAD_LETTER_QUEUE, { noAck: false });

        if (message === false) {
          break;
        }

        const originalRoutingKey = readOriginalRoutingKey(message);
        const originalExchange = readOriginalExchange(message);

        if (originalRoutingKey === null || originalExchange === null) {
          channel.nack(message, false, true);
          break;
        }

        channel.publish(originalExchange, originalRoutingKey, message.content, {
          contentType: message.properties.contentType,
          deliveryMode: 2,
          persistent: true,
          headers: sanitizeDeadLetterReplayHeaders(message),
        });
        channel.ack(message);
        replayed += 1;
      }

      await channel.waitForConfirms();
      return { replayed };
    } finally {
      await closeRabbitResources(channel, connection);
    }
  }

  private async inspectOne(queueName: string): Promise<RabbitQueueSnapshot> {
    const connection = await connect(this.url);
    const channel = await connection.createConfirmChannel();

    try {
      const status = await channel.checkQueue(queueName);
      return {
        name: queueName,
        status: "available",
        messageCount: status.messageCount,
        consumerCount: status.consumerCount,
      };
    } catch {
      return {
        name: queueName,
        status: "missing",
        messageCount: null,
        consumerCount: null,
      };
    } finally {
      await closeRabbitResources(channel, connection);
    }
  }
}

export type RabbitConsumerOptions = RabbitPublisherOptions & {
  readonly queue: string;
  readonly prefetch?: number;
  readonly maxRetries?: number;
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
    } catch (error) {
      await handleRabbitConsumerFailure(
        this.channel,
        message,
        error,
        this.options.maxRetries ?? DEFAULT_RABBIT_MAX_RETRIES,
      );
    }
  }
}

export type RabbitFailureAction =
  | {
      readonly kind: "retry";
      readonly retryCount: number;
      readonly headers: RabbitHeaders;
    }
  | {
      readonly kind: "dead-letter";
      readonly retryCount: number;
      readonly headers: RabbitHeaders;
    };

type RabbitFailureChannel = Pick<ConfirmChannel, "publish" | "waitForConfirms" | "ack" | "nack">;

export async function handleRabbitConsumerFailure(
  channel: RabbitFailureChannel,
  message: ConsumeMessage,
  error: unknown,
  maxRetries = DEFAULT_RABBIT_MAX_RETRIES,
): Promise<RabbitFailureAction> {
  const action = resolveRabbitFailureAction(message, error, maxRetries);

  if (action.kind === "retry") {
    channel.publish(message.fields.exchange, message.fields.routingKey, message.content, {
      ...toRetryPublishOptions(message),
      headers: action.headers,
    });
    await channel.waitForConfirms();
    channel.ack(message);
    return action;
  }

  channel.nack(message, false, false);
  return action;
}

export function resolveRabbitFailureAction(
  message: ConsumeMessage | GetMessage,
  error: unknown,
  maxRetries = DEFAULT_RABBIT_MAX_RETRIES,
): RabbitFailureAction {
  const currentRetryCount = readRabbitRetryCount(message);
  const nextRetryCount = currentRetryCount + 1;
  const headers = {
    ...readHeaders(message),
    [RABBIT_FAILURE_REASON_HEADER]: formatFailureReason(error),
  };

  if (currentRetryCount >= maxRetries) {
    return {
      kind: "dead-letter",
      retryCount: currentRetryCount,
      headers,
    };
  }

  return {
    kind: "retry",
    retryCount: nextRetryCount,
    headers: {
      ...headers,
      [RABBIT_RETRY_COUNT_HEADER]: nextRetryCount,
    },
  };
}

export function readRabbitRetryCount(message: ConsumeMessage | GetMessage): number {
  const value = readHeaders(message)[RABBIT_RETRY_COUNT_HEADER];

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);

    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

async function assertDeadLetterTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, "dead.telemetry");
}

async function closeRabbitResources(
  channel: ConfirmChannel,
  connection: ChannelModel,
): Promise<void> {
  try {
    await channel.close();
  } catch {
    // Missing queues close the channel in RabbitMQ; the connection close below is enough.
  }

  await connection.close();
}

export function toDeadLetterMessage(message: GetMessage): RabbitDeadLetterMessage {
  return {
    id: `${message.fields.deliveryTag}`,
    routingKey: message.fields.routingKey,
    exchange: message.fields.exchange,
    redelivered: message.fields.redelivered,
    contentType: message.properties.contentType,
    retryCount: readRabbitRetryCount(message),
    deadLetterReason: readDeadLetterReason(message),
    failureReason: readHeaderString(readHeaders(message), RABBIT_FAILURE_REASON_HEADER),
    originalExchange: readOriginalExchange(message),
    originalRoutingKey: readOriginalRoutingKey(message),
    payload: parsePayload(message.content),
  };
}

export function sanitizeDeadLetterReplayHeaders(message: GetMessage): RabbitHeaders {
  const {
    [RABBIT_RETRY_COUNT_HEADER]: _retryCount,
    [RABBIT_FAILURE_REASON_HEADER]: _failureReason,
    "x-death": _death,
    ...headers
  } = readHeaders(message);

  return {
    ...headers,
    [RABBIT_REPLAYED_AT_HEADER]: new Date().toISOString(),
  };
}

function toRetryPublishOptions(message: ConsumeMessage): Options.Publish {
  return {
    contentType: message.properties.contentType,
    deliveryMode: 2,
    persistent: true,
    timestamp: Math.floor(Date.now() / 1_000),
    correlationId: message.properties.correlationId,
    messageId: message.properties.messageId,
  };
}

function readDeadLetterReason(message: GetMessage): string | null {
  const death = readLatestDeath(message);
  return readHeaderString(death, "reason");
}

function readOriginalExchange(message: GetMessage): string | null {
  const death = readLatestDeath(message);
  return readHeaderString(death, "exchange");
}

function readOriginalRoutingKey(message: GetMessage): string | null {
  const death = readLatestDeath(message);
  const routingKeys = death?.["routing-keys"];

  if (Array.isArray(routingKeys) && typeof routingKeys[0] === "string") {
    return routingKeys[0];
  }

  return null;
}

function readLatestDeath(message: GetMessage): RabbitHeaders | null {
  const death = readHeaders(message)["x-death"];
  return Array.isArray(death) && typeof death[0] === "object" && death[0] !== null
    ? (death[0] as unknown as RabbitHeaders)
    : null;
}

function readHeaders(message: ConsumeMessage | GetMessage): RabbitHeaders {
  return message.properties.headers ?? {};
}

function readHeaderString(headers: RabbitHeaders | null, key: string): string | null {
  const value = headers?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parsePayload(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString("utf8")) as unknown;
  } catch {
    return payload.toString("utf8");
  }
}

function formatFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 500 ? message : message.slice(0, 500);
}
