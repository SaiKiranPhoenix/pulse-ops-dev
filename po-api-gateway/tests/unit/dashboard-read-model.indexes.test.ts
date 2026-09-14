import { describe, expect, it } from "vitest";

import {
  DashboardEventModel,
  DashboardIncidentModel,
  DashboardIngestionAcceptanceModel,
  DashboardVaultSecretModel,
} from "../../src/models/dashboard-read.model.js";

describe("dashboard read model indexes", () => {
  it("declares telemetry indexes for dashboard pagination, filters, traces, and retention", () => {
    expect(DashboardEventModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, receivedAt: -1, _id: -1 },
          expect.objectContaining({ name: "idx_events_project_received_cursor" }),
        ],
        [
          { projectId: 1, type: 1, receivedAt: -1 },
          expect.objectContaining({ name: "idx_events_project_type_received" }),
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

  it("declares incident indexes for dashboard sorting and event correlation", () => {
    expect(DashboardIncidentModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, status: 1, lastSeenAt: -1 },
          expect.objectContaining({ name: "idx_incidents_project_status_last_seen" }),
        ],
        [
          { projectId: 1, lastSeenAt: -1 },
          expect.objectContaining({ name: "idx_incidents_project_last_seen" }),
        ],
        [
          { projectId: 1, fingerprint: 1, lastSeenAt: -1 },
          expect.objectContaining({ name: "idx_incidents_project_fingerprint_last_seen" }),
        ],
        [
          { projectId: 1, "samples.eventId": 1 },
          expect.objectContaining({ name: "idx_incidents_project_sample_event" }),
        ],
      ]),
    );
  });

  it("declares vault and ingestion read indexes", () => {
    expect(DashboardVaultSecretModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, environment: 1, key: 1, status: 1 },
          expect.objectContaining({ name: "idx_vault_secrets_project_env_key_status" }),
        ],
        [
          { projectId: 1, updatedAt: -1 },
          expect.objectContaining({ name: "idx_vault_secrets_project_updated" }),
        ],
      ]),
    );

    expect(DashboardIngestionAcceptanceModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, createdAt: -1 },
          expect.objectContaining({ name: "idx_ingestion_acceptances_project_created" }),
        ],
      ]),
    );
  });
});
