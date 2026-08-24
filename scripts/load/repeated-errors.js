import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS ?? 3),
  iterations: Number(__ENV.ITERATIONS ?? 30),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<750"],
  },
};

const apiBaseUrl = __ENV.API_BASE_URL ?? "http://localhost:4000";
const apiKey = __ENV.PULSEOPS_API_KEY;
const source = __ENV.SOURCE ?? "k6-errors";

export default function () {
  const payload = JSON.stringify({
    source,
    level: "error",
    message: "payment provider timeout",
    fingerprint: __ENV.FINGERPRINT ?? "k6-payment-provider-timeout",
    attributes: {
      scenario: "repeated-errors",
    },
    observedAt: new Date().toISOString(),
  });

  const response = http.post(`${apiBaseUrl}/ingest/errors`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "idempotency-key": `errors-${__VU}-${__ITER}`,
    },
  });

  check(response, {
    "error accepted": (item) => item.status === 202,
  });
  sleep(0.2);
}
