import { describe, expect, it } from "vitest";

import { IngestedEventModel } from "../../src/models/ingested-event.model.js";
import { IngestionAcceptanceModel } from "../../src/models/ingestion-acceptance.model.js";

describe("ingestion-owned indexes", () => {
  it("keeps telemetry indexes aligned with dashboard and worker read paths", () => {
    expect(IngestedEventModel.schema.indexes()).toEqual(
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

  it("supports idempotency and dashboard ingestion-stat lookups", () => {
    expect(IngestionAcceptanceModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, idempotencyKey: 1 },
          expect.objectContaining({
            name: "uniq_ingestion_acceptances_project_idempotency",
            unique: true,
          }),
        ],
        [
          { projectId: 1, createdAt: -1 },
          expect.objectContaining({ name: "idx_ingestion_acceptances_project_created" }),
        ],
      ]),
    );
  });
});
