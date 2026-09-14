# RabbitMQ Retry And DLQ

PulseOps consumers use manual acknowledgements.

## Retry Flow

When a consumer handler succeeds, the delivery is acknowledged.

When a handler fails before the retry budget is exhausted, the consumer republishes the same payload to the original exchange/routing key with:

- `x-pulseops-retry-count`
- `x-pulseops-failure-reason`

After RabbitMQ confirms the republish, the original delivery is acknowledged. The default retry budget is 3 attempts.

## Dead-Letter Flow

When the retry count reaches the retry budget, the consumer rejects the message with `requeue=false`. RabbitMQ moves it to the shared dead-letter exchange and queue through the queue dead-letter settings.

The dead-letter dashboard shows:

- original routing key
- original exchange
- RabbitMQ dead-letter reason
- PulseOps failure reason
- PulseOps retry count
- payload preview

Manual replay republishes to the original exchange/routing key, removes stale retry and dead-letter headers, and adds `x-pulseops-replayed-at`.

## Verification

The shared messaging tests cover:

- retry metadata increments
- retry republish followed by manual ack
- poison-message nack with `requeue=false`
- dead-letter metadata parsing
- replay header cleanup

Worker tests also assert retry-count metadata is reflected in worker heartbeat stats.
