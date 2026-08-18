# PulseOps Incident Detection

## MVP Rules

PulseOps creates incidents automatically for:

1. repeated error fingerprint threshold
2. high latency threshold

Optional Version 1.5 rule:

- queue backlog threshold

## Error Fingerprinting

Fingerprint input:

- project id
- environment
- service name
- normalized error message
- stack hash if provided
- top stack frame if provided

Normalization:

- lowercase message
- remove UUIDs, object ids, request ids, numbers likely to be dynamic, and timestamps
- trim whitespace
- include error name/type when provided

Output:

- stable SHA-256 hash stored as `fingerprint`

Reason:

- groups repeated errors without storing raw stack traces as the identity.

## Error Grouping

- All error events with same project/environment/service/fingerprint belong to one error group.
- The dashboard can show group count, first seen, last seen, latest message sample, and linked incidents.
- Error groups can be derived from `events` in MVP; a separate `errorGroups` collection can be added later.

## Repeated Error Rule

Default threshold:

- 20 occurrences of the same fingerprint in 5 minutes.

Redis:

- `error:{projectId}:{env}:{fingerprint}` count and recent event ids
- TTL: 5 minutes plus safety buffer

MongoDB:

- event records provide durable history
- incident record provides status lifecycle

Flow:

1. Error worker persists error event.
2. Error worker increments Redis fingerprint counter.
3. If threshold is crossed, worker publishes `incident.evaluate`.
4. Incident worker obtains dedupe lock.
5. Incident worker upserts an open incident or updates existing open incident.
6. Realtime gateway emits `incident.created` or `incident.updated`.

## High Latency Rule

Default threshold:

- p95 latency above 1000 ms over 5 minutes.
- minimum sample count: 20 metric events.

Redis:

- bucket latency samples by project/environment/service.
- TTL: 6 minutes.

MongoDB:

- metric events provide durable details.
- incident stores threshold metadata.

MVP implementation option:

- Store recent latency samples in Redis sorted sets or bounded lists.
- Calculate p95 in worker for each bucket.

## Severity Rules

| Condition | Severity |
| --- | --- |
| repeated error count >= 20 in 5 min | warning |
| repeated error count >= 50 in 5 min | critical |
| p95 latency > 1000 ms | warning |
| p95 latency > 2500 ms | critical |
| queue backlog threshold later | warning or critical by age/depth |

## Incident Deduplication

Open incident uniqueness:

- project id
- environment
- service
- rule type
- fingerprint for error incidents
- metric name for latency incidents
- status open or acknowledged

If matching incident exists:

- update `lastSeenAt`
- increment occurrence metadata
- append bounded related event ids
- do not create a duplicate

## Incident Lifecycle

| Status | Meaning |
| --- | --- |
| `open` | automatically created and unresolved |
| `acknowledged` | user has seen it but not resolved |
| `resolved` | user manually resolved |

MVP resolution:

- manual resolve only.
- automatic recovery detection is Version 2.

## Examples

Repeated error:

- `CheckoutService` sends the same normalized database timeout error 20 times in 5 minutes.
- Redis count crosses threshold.
- Incident worker creates warning incident with reason `Repeated error fingerprint exceeded 20 events in 5 minutes`.

High latency:

- `BillingService` reports 40 latency metrics in 5 minutes.
- Calculated p95 is 1400 ms.
- Incident worker creates warning incident with threshold metadata.

Existing incident:

- Same error continues after incident is open.
- Incident updates `lastSeenAt` and occurrence count.
- Dashboard receives `incident.updated`, not a second incident card.

Manual resolve:

- User resolves incident.
- Status changes to `resolved`.
- Later threshold crossing can create a new incident with a fresh lifecycle.
