import { describe, expect, it } from "vitest";

import { EventModel } from "../../src/models/event.model.js";

describe("EventModel indexes", () => {
  it("declares retention, dashboard pagination, and correlation indexes", () => {
    expect(EventModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, receivedAt: -1, _id: -1 },
          expect.objectContaining({ name: "idx_events_project_received_cursor" }),
        ],
        [
          { projectId: 1, fingerprint: 1, receivedAt: -1 },
          expect.objectContaining({ name: "idx_events_project_fingerprint_received" }),
        ],
        [
          { projectId: 1, "attributes.environment": 1, type: 1, receivedAt: -1 },
          expect.objectContaining({ name: "idx_events_project_env_type_received" }),
        ],
        [
          {
            projectId: 1,
            "attributes.traceId": 1,
            "attributes.spanId": 1,
            observedAt: 1,
            receivedAt: 1,
          },
          expect.objectContaining({ name: "idx_events_project_trace_span_time" }),
        ],
        [
          { receivedAt: 1 },
          expect.objectContaining({
            expireAfterSeconds: 2_592_000,
            name: "ttl_events_received_at_30_days",
          }),
        ],
      ]),
    );
  });
});
