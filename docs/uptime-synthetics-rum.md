# Uptime, Synthetics & Real User Monitoring (RUM)

PulseOps provides high-frequency synthetic probing, HTTP uptime tracking, multi-rule assertion SLA verification, and client-side Google Core Web Vitals (RUM) analytics.

---

## 1. Synthetic Assertions

PulseOps monitors evaluate multiple assertions per check cycle:

```json
{
  "syntheticAssertions": [
    {
      "type": "status_code",
      "target": "status",
      "operator": "equals",
      "expectedValue": 200
    },
    {
      "type": "response_time",
      "target": "latency",
      "operator": "less_than",
      "expectedValue": 500
    },
    {
      "type": "body_contains",
      "target": "body",
      "operator": "contains",
      "expectedValue": "healthy"
    }
  ]
}
```

### Supported Assertion Types & Operators

- **`status_code`**: `equals`, `less_than`, `greater_than`
- **`response_time`**: `less_than` (SLA latency guardrails)
- **`body_contains`**: `contains`, `regex`
- **`header_matches`**: `equals`, `contains`

---

## 2. Core Web Vitals & Real User Monitoring (RUM)

PulseOps captures client-side Google Web Vitals metrics via the `@pulseops/rum` SDK or lightweight inline snippet:

- **Largest Contentful Paint (LCP)**: Target &lt; 2.5s (Loading performance)
- **First Input Delay (FID) / INP**: Target &lt; 100ms (Interactivity & responsiveness)
- **Cumulative Layout Shift (CLS)**: Target &lt; 0.1 (Visual stability)
- **Time to First Byte (TTFB)**: Target &lt; 800ms (Server response speed)

### Ingesting Web Vitals

`POST /rum/vitals`

```json
{
  "sessionId": "sess_891823a",
  "pageUrl": "https://app.example.com/checkout",
  "lcpMs": 1450,
  "fidMs": 28,
  "cls": 0.03,
  "device": "desktop",
  "browser": "Chrome",
  "os": "macOS"
}
```
