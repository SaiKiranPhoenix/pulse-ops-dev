# APM & Distributed Tracing Specification

PulseOps provides enterprise-grade Application Performance Monitoring (APM) and distributed tracing aligned with W3C TraceContext standards and OpenTelemetry protocols.

---

## 1. W3C TraceContext Specification

PulseOps natively supports and propagates the W3C `traceparent` HTTP header:

```
traceparent = version "-" trace-id "-" parent-id "-" trace-flags
```

- **`version`**: `00` (Current W3C recommendation)
- **`trace-id`**: 16 bytes (32 hex characters). Uniquely identifies the entire distributed transaction across all downstream services.
- **`parent-id`**: 8 bytes (16 hex characters). Identifies the caller's span.
- **`trace-flags`**: 8-bit field (e.g. `01` for sampled, `00` for unsampled).

### Example Header

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

---

## 2. Ingestion Endpoints

PulseOps API Gateway and Ingestion Service expose dedicated APM ingestion routes:

### `POST /ingest/spans`

```json
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "parentSpanId": "5c68f17a942b0833",
  "name": "POST /v1/checkout",
  "kind": "server",
  "serviceName": "checkout-service",
  "startTime": "2026-08-31T10:00:00.000Z",
  "endTime": "2026-08-31T10:00:00.045Z",
  "durationMs": 45.2,
  "statusCode": "ok",
  "attributes": {
    "http.method": "POST",
    "http.status_code": 200,
    "user.id": "usr_99812"
  }
}
```

### `POST /ingest/traces`

Accepts a full trace payload with an array of spans for batch or offline processing.

---

## 3. Node.js SDK Usage (`@pulseops/node-sdk`)

### Manual Span Instrumentation

```typescript
import { withSpan, formatW3CTraceParent } from "@pulseops/node-sdk";

// Execute an operation with automatic duration & error capture
const { result, span } = await withSpan(
  "db.query.findUser",
  { serviceName: "auth-service" },
  async (activeSpan) => {
    activeSpan.setAttribute("db.table", "users");
    const user = await db.users.findById(id);
    return user;
  },
);
```

### Propagating Downstream

```typescript
const traceparent = activeSpan.getTraceParent();

// Pass down in outgoing HTTP requests:
await fetch("https://inventory.internal/items", {
  headers: {
    traceparent: traceparent,
  },
});
```

---

## 4. OpenTelemetry (OTel) Compatibility & Bridge

PulseOps trace identifiers, span models, and attributes map 1:1 to OpenTelemetry SemConv specifications:

| OpenTelemetry Attribute | PulseOps Equivalent              |
| ----------------------- | -------------------------------- |
| `trace_id`              | `traceId`                        |
| `span_id`               | `spanId`                         |
| `parent_span_id`        | `parentSpanId`                   |
| `service.name`          | `serviceName`                    |
| `http.status_code`      | `attributes["http.status_code"]` |
| `db.system`             | `attributes["db.system"]`        |
| `error.type`            | `attributes["error.type"]`       |

### OpenTelemetry Collector Configuration

To route OTel Collector traces to PulseOps:

```yaml
exporters:
  otlphttp/pulseops:
    endpoint: "https://api.pulseops.dev/ingest"
    headers:
      x-api-key: "<PULSEOPS_API_KEY>"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/pulseops]
```
