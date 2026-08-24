import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS ?? 5),
  duration: __ENV.DURATION ?? "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<500"],
  },
};

const apiBaseUrl = __ENV.API_BASE_URL ?? "http://localhost:4000";
const apiKey = __ENV.PULSEOPS_API_KEY;
const source = __ENV.SOURCE ?? "k6-normal";

export default function () {
  const payload = JSON.stringify({
    source,
    level: "info",
    message: `normal traffic ${__VU}-${__ITER}`,
    attributes: {
      scenario: "normal-traffic",
      iteration: __ITER,
    },
    observedAt: new Date().toISOString(),
  });

  const response = http.post(`${apiBaseUrl}/ingest/logs`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "idempotency-key": `normal-${__VU}-${__ITER}`,
    },
  });

  check(response, {
    "log accepted": (item) => item.status === 202,
  });
  sleep(1);
}
