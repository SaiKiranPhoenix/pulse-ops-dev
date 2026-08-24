import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS ?? 4),
  iterations: Number(__ENV.ITERATIONS ?? 40),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<750"],
  },
};

const apiBaseUrl = __ENV.API_BASE_URL ?? "http://localhost:4000";
const apiKey = __ENV.PULSEOPS_API_KEY;
const source = __ENV.SOURCE ?? "k6-latency";
const latencyMs = Number(__ENV.LATENCY_MS ?? 1_250);

export default function () {
  const payload = JSON.stringify({
    source,
    name: "request.latency",
    value: latencyMs,
    unit: "ms",
    fingerprint: __ENV.FINGERPRINT ?? "k6-high-latency",
    attributes: {
      scenario: "high-latency",
      latencyMs,
    },
    timestamp: new Date().toISOString(),
  });

  const response = http.post(`${apiBaseUrl}/ingest/metrics`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "idempotency-key": `latency-${__VU}-${__ITER}`,
    },
  });

  check(response, {
    "metric accepted": (item) => item.status === 202,
  });
  sleep(0.2);
}
