import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsumeMessage, GetMessage } from "amqplib";
import {
  RABBIT_FAILURE_REASON_HEADER,
  RABBIT_REPLAYED_AT_HEADER,
  RABBIT_RETRY_COUNT_HEADER,
  handleRabbitConsumerFailure,
  readRabbitRetryCount,
  resolveRabbitFailureAction,
  sanitizeDeadLetterReplayHeaders,
  toDeadLetterMessage,
} from "../../src/messaging/rabbitmq.js";

describe("RabbitMQ retry and DLQ helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("increments retry metadata until the bounded retry limit is reached", () => {
    const message = createConsumeMessage({ headers: { [RABBIT_RETRY_COUNT_HEADER]: 2 } });

    expect(resolveRabbitFailureAction(message, new Error("handler failed"), 3)).toEqual({
      kind: "retry",
      retryCount: 3,
      headers: {
        [RABBIT_RETRY_COUNT_HEADER]: 3,
        [RABBIT_FAILURE_REASON_HEADER]: "handler failed",
      },
    });
  });

  it("chooses dead-letter parking after the retry budget is exhausted", () => {
    const message = createConsumeMessage({ headers: { [RABBIT_RETRY_COUNT_HEADER]: 3 } });

    expect(resolveRabbitFailureAction(message, new Error("still broken"), 3)).toEqual({
      kind: "dead-letter",
      retryCount: 3,
      headers: {
        [RABBIT_RETRY_COUNT_HEADER]: 3,
        [RABBIT_FAILURE_REASON_HEADER]: "still broken",
      },
    });
  });

  it("republishes failed messages for retry and acks the original delivery", async () => {
    const channel = new FakeFailureChannel();
    const message = createConsumeMessage({ headers: { [RABBIT_RETRY_COUNT_HEADER]: 1 } });

    await expect(
      handleRabbitConsumerFailure(channel.asChannel(), message, new Error("retry me"), 3),
    ).resolves.toMatchObject({ kind: "retry", retryCount: 2 });

    expect(channel.published).toEqual([
      expect.objectContaining({
        exchange: "pulseops.telemetry",
        routingKey: "telemetry.error.v1",
        headers: expect.objectContaining({
          [RABBIT_RETRY_COUNT_HEADER]: 2,
          [RABBIT_FAILURE_REASON_HEADER]: "retry me",
        }),
      }),
    ]);
    expect(channel.acked).toEqual([message]);
    expect(channel.nacked).toEqual([]);
  });

  it("nacks poison messages without requeue so RabbitMQ moves them to the DLQ", async () => {
    const channel = new FakeFailureChannel();
    const message = createConsumeMessage({ headers: { [RABBIT_RETRY_COUNT_HEADER]: 3 } });

    await expect(
      handleRabbitConsumerFailure(channel.asChannel(), message, new Error("poison"), 3),
    ).resolves.toMatchObject({ kind: "dead-letter", retryCount: 3 });

    expect(channel.published).toEqual([]);
    expect(channel.acked).toEqual([]);
    expect(channel.nacked).toEqual([{ message, allUpTo: false, requeue: false }]);
  });

  it("parses retry and dead-letter reason metadata for dashboard display", () => {
    const message = createGetMessage({
      headers: {
        [RABBIT_RETRY_COUNT_HEADER]: "3",
        [RABBIT_FAILURE_REASON_HEADER]: "schema parse failed",
        "x-death": [
          {
            reason: "rejected",
            exchange: "pulseops.telemetry",
            "routing-keys": ["telemetry.error.v1"],
          },
        ],
      },
    });

    expect(readRabbitRetryCount(message)).toBe(3);
    expect(toDeadLetterMessage(message)).toMatchObject({
      retryCount: 3,
      deadLetterReason: "rejected",
      failureReason: "schema parse failed",
      originalExchange: "pulseops.telemetry",
      originalRoutingKey: "telemetry.error.v1",
      payload: { ok: false },
    });
  });

  it("clears retry and x-death headers when replaying dead-letter messages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T00:00:00.000Z"));
    const message = createGetMessage({
      headers: {
        keep: "me",
        [RABBIT_RETRY_COUNT_HEADER]: 3,
        [RABBIT_FAILURE_REASON_HEADER]: "old failure",
        "x-death": [{ reason: "rejected" }],
      },
    });

    expect(sanitizeDeadLetterReplayHeaders(message)).toEqual({
      keep: "me",
      [RABBIT_REPLAYED_AT_HEADER]: "2026-08-18T00:00:00.000Z",
    });
  });
});

class FakeFailureChannel {
  readonly published: Array<{
    readonly exchange: string;
    readonly routingKey: string;
    readonly headers: unknown;
  }> = [];
  readonly acked: ConsumeMessage[] = [];
  readonly nacked: Array<{
    readonly message: ConsumeMessage;
    readonly allUpTo: boolean;
    readonly requeue: boolean;
  }> = [];

  asChannel() {
    return this as never;
  }

  publish(
    exchange: string,
    routingKey: string,
    _content: Buffer,
    options: { readonly headers?: unknown },
  ): boolean {
    this.published.push({ exchange, routingKey, headers: options.headers });
    return true;
  }

  async waitForConfirms(): Promise<void> {}

  ack(message: ConsumeMessage): void {
    this.acked.push(message);
  }

  nack(message: ConsumeMessage, allUpTo: boolean, requeue: boolean): void {
    this.nacked.push({ message, allUpTo, requeue });
  }
}

function createConsumeMessage(options: { readonly headers?: Record<string, unknown> } = {}) {
  return {
    content: Buffer.from(JSON.stringify({ ok: false })),
    fields: {
      consumerTag: "consumer",
      deliveryTag: 1,
      redelivered: false,
      exchange: "pulseops.telemetry",
      routingKey: "telemetry.error.v1",
    },
    properties: {
      contentType: "application/json",
      headers: options.headers ?? {},
    },
  } as ConsumeMessage;
}

function createGetMessage(options: { readonly headers?: Record<string, unknown> } = {}) {
  return {
    ...createConsumeMessage(options),
    fields: {
      deliveryTag: 99,
      redelivered: false,
      exchange: "pulseops.dlx",
      routingKey: "dead.telemetry",
      messageCount: 0,
    },
  } as GetMessage;
}
