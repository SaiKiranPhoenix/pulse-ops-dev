import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: Number(__ENV.VUS ?? 20),
  iterations: Number(__ENV.ITERATIONS ?? 200),
  thresholds: {
    http_req_duration: ["p(95)<1000"],
  },
};

const apiBaseUrl = __ENV.API_BASE_URL ?? "http://localhost:4000";
const apiKey = __ENV.PULSEOPS_API_KEY;

export default function () {
  const payload = JSON.stringify({
    source: "k6-rate-limit",
    level: "info",
    message: `rate limit probe ${__VU}-${__ITER}`,
    observedAt: new Date().toISOString(),
  });

  const response = http.post(`${apiBaseUrl}/ingest/logs`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "idempotency-key": `rate-${__VU}-${__ITER}`,
    },
  });

  check(response, {
    "accepted or limited": (item) => item.status === 202 || item.status === 429,
  });
}
