import { describe, expect, it } from "vitest";

import { IncidentModel } from "../../src/models/incident.model.js";

describe("IncidentModel indexes", () => {
  it("declares incident query and event-correlation indexes", () => {
    expect(IncidentModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { projectId: 1, fingerprint: 1 },
          expect.objectContaining({
            name: "uniq_incidents_open_project_fingerprint",
            unique: true,
          }),
        ],
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
});
